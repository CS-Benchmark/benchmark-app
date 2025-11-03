import {useEffect, useState, useCallback, useMemo} from 'react'
import {supabase} from '../supabaseClient'
import type {BenchmarkProjectMetadata, Benchmark, CategoryFilters} from '../types/benchmark'
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer} from 'recharts'
import './BenchmarkCharts.css'

interface BenchmarkChartsProps {
    project: BenchmarkProjectMetadata
    onBack: () => void
}

interface ChartDataPoint {
    timestamp: string
    fullTimestamp: string

    [key: string]: string | number | null
}

// Helper to manage recently used filters in localStorage
const getRecentFilters = (project: string): CategoryFilters[] => {
    const stored = localStorage.getItem(`recentFilters-${project}`)
    return stored ? JSON.parse(stored) : []
}

const addRecentFilter = (project: string, filters: CategoryFilters) => {
    if (Object.keys(filters).length === 0) return

    const recent = getRecentFilters(project)
    const updated = [filters, ...recent.filter(f => JSON.stringify(f) !== JSON.stringify(filters))].slice(0, 3)

    localStorage.setItem(`recentFilters-${project}`, JSON.stringify(updated))
}

export function BenchmarkCharts({project, onBack}: BenchmarkChartsProps) {
    const [categories, setCategories] = useState<{ [key: string]: string[] }>({})
    const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showCharts, setShowCharts] = useState(false)
    const [recentFilters, setRecentFilters] = useState<CategoryFilters[]>([])
    const [exampleFilters, setExampleFilters] = useState<CategoryFilters[]>([])

    // Extract active category names from metadata - memoize to prevent recreating on every render
    const activeCategoryFields = useMemo(() =>
            [
                {key: 'category1', name: project.category1_name},
                {key: 'category2', name: project.category2_name},
                {key: 'category3', name: project.category3_name},
                {key: 'category4', name: project.category4_name},
                {key: 'category5', name: project.category5_name},
            ].filter(cat => cat.name !== null) as { key: string; name: string }[]
        , [project.category1_name, project.category2_name, project.category3_name, project.category4_name, project.category5_name])

    const [selectedCategories, setSelectedCategories] = useState<CategoryFilters>(() => {
        const initialCategories: CategoryFilters = {}
        const params = new URLSearchParams(window.location.search)
        activeCategoryFields.forEach(({key}) => {
            const value = params.get(key)
            if (value) {
                initialCategories[key as keyof CategoryFilters] = value
            }
        })
        return initialCategories
    })

    // Extract active value names from metadata - memoize to prevent recreating on every render
    const activeValueFields = useMemo(() =>
            [
                {key: 'value1', name: project.value1_name},
                {key: 'value2', name: project.value2_name},
                {key: 'value3', name: project.value3_name},
                {key: 'value4', name: project.value4_name},
                {key: 'value5', name: project.value5_name},
            ].filter(val => val.name !== null) as { key: string; name: string }[]
        , [project.value1_name, project.value2_name, project.value3_name, project.value4_name, project.value5_name])

    const fetchCategoriesAndExamples = useCallback(async () => {
        try {
            setLoading(true)

            // Fetch distinct values for each active category in parallel
            const categoryPromises = activeCategoryFields.map(async ({key}) => {
                const {data, error: fetchError} = await supabase
                    .rpc('get_distinct_categories', {
                        p_project: project.project,
                        p_category_column: key
                    })

                if (fetchError) throw fetchError

                // Extract values from the returned rows
                const values = (data || []).map((row: { value: string }) => row.value).sort()

                return {key, values}
            })

            // Also fetch a small sample of benchmarks to generate examples
            const exampleDataPromise = supabase
                .from('benchmarks')
                .select(activeCategoryFields.map(c => c.key).join(','))
                .eq('project', project.project)
                .limit(100) // Fetch 100 records to find 3 unique examples

            const [categoryResults, {data: exampleData, error: exampleError}] = await Promise.all([
                Promise.all(categoryPromises),
                exampleDataPromise
            ])

            // Convert results to categoryMap
            const categoriesData: { [key: string]: string[] } = {}
            categoryResults.forEach(({key, values}) => {
                categoriesData[key] = values
            })
            setCategories(categoriesData)

            // Generate examples from the sample data
            if (exampleError) {
                console.warn('Could not fetch example data:', exampleError.message)
            } else if (exampleData) {
                const examples: CategoryFilters[] = []
                const exampleComboKeys = new Set<string>()

                exampleData.forEach(benchmark => {
                    const combo: CategoryFilters = {}
                    let comboKey = ''
                    const row = benchmark as Record<string, string | null>
                    activeCategoryFields.forEach(({key}) => {
                        const value = row[key] || undefined
                        if (value) {
                            combo[key as keyof CategoryFilters] = value
                            comboKey += `${key}:${value}|`
                        }
                    })

                    if (Object.keys(combo).length > 0 && examples.length < 3 && !exampleComboKeys.has(comboKey)) {
                        examples.push(combo)
                        exampleComboKeys.add(comboKey)
                    }
                })
                setExampleFilters(examples)
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
            console.error('Error fetching categories or examples:', err)
        } finally {
            setLoading(false)
        }
    }, [project.project, activeCategoryFields])

    useEffect(() => {
        fetchCategoriesAndExamples()
        setRecentFilters(getRecentFilters(project.project))
    }, [fetchCategoriesAndExamples, project.project])

    // If categories are pre-selected from URL, fetch benchmarks automatically
    useEffect(() => {
        const hasPreselectedCategories = activeCategoryFields.some(({key}) => {
            return new URLSearchParams(window.location.search).has(key)
        })

        if (hasPreselectedCategories) {
            fetchBenchmarks()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCategoryFields]) // Only run when activeCategoryFields are determined

    // Accept optional override filters to support immediate fetching from suggested filters
    async function fetchBenchmarks(filtersOverride?: CategoryFilters) {
        try {
            setLoading(true)
            setError(null)

            const effectiveFilters = filtersOverride ?? selectedCategories

            // Save filters to recent list
            if (Object.keys(effectiveFilters).length > 0) {
                addRecentFilter(project.project, effectiveFilters)
                setRecentFilters(getRecentFilters(project.project))
            }

            let query = supabase
                .from('benchmarks')
                .select('*', {count: 'exact'})
                .eq('project', project.project)

            // Apply category filters
            activeCategoryFields.forEach(({key}) => {
                const selectedValue = effectiveFilters[key as keyof CategoryFilters]
                if (selectedValue) {
                    query = query.eq(key, selectedValue)
                }
            })

            // Limit to 10,000 records for performance - add pagination if needed
            query = query.order('timestamp', {ascending: true}).limit(10000)

            const {data, error: fetchError, count} = await query

            if (fetchError) {
                setError(fetchError.message)
                return
            }

            // Warn if hitting the limit
            if (count && count > 10000) {
                setError(`Warning: Results limited to 10,000 of ${count.toLocaleString()} total records. Please apply more specific filters to see all data.`)
            }

            // Check number of unique combinations
            const benchmarkData = data || []
            const uniqueCombos = new Set<string>()

            benchmarkData.forEach(benchmark => {
                const fullKey = activeCategoryFields
                    .map(({key}) => benchmark[key as keyof typeof benchmark] || 'null')
                    .join('|')
                uniqueCombos.add(fullKey)
            })

            if (uniqueCombos.size > 25) {
                setError(`Too many category combinations (${uniqueCombos.size} found). Please select more specific filters to reduce combinations to 25 or fewer.`)
                setLoading(false)
                return
            }

            setBenchmarks(benchmarkData)
            setShowCharts(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
            console.error('Error fetching benchmarks:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCategoryChange = (categoryKey: string, value: string) => {
        setSelectedCategories(prev => {
            const newCats = {...prev}
            if (value) {
                newCats[categoryKey as keyof CategoryFilters] = value
            } else {
                delete newCats[categoryKey as keyof CategoryFilters]
            }

            // Update URL
            const params = new URLSearchParams(window.location.search)
            Object.keys(newCats).forEach(key => {
                const catValue = newCats[key as keyof CategoryFilters]
                if (catValue) {
                    params.set(key, catValue)
                } else {
                    params.delete(key)
                }
            })
            // clean up old keys
            Object.keys(prev).forEach(key => {
                if (!newCats[key as keyof CategoryFilters]) {
                    params.delete(key)
                }
            })


            window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`)

            return newCats
        })
    }

    const handleShowCharts = () => {
        // Ensure we fetch using the latest selected categories
        fetchBenchmarks(selectedCategories)
    }

    const applyFilterSet = (filters: CategoryFilters) => {
        setSelectedCategories(filters)
        // We need to manually update the URL here as the state change doesn't trigger the effect
        const params = new URLSearchParams()
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                params.set(key, value)
            }
        })
        window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`)

        // Immediately fetch benchmarks for the chosen filters and show charts
        fetchBenchmarks(filters)
    }

    const handleResetFilters = () => {
        setSelectedCategories({})
        setShowCharts(false)
        setBenchmarks([])
        // Reset URL
        const params = new URLSearchParams(window.location.search)
        activeCategoryFields.forEach(({key}) => params.delete(key))
        window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`)
    }

    const handleChangeFilters = () => {
        setShowCharts(false)
    }

    // Generate a unique key for a category combination
    const getCategoryKey = useCallback((benchmark: Benchmark): string => {
        return activeCategoryFields
            .map(({key}) => benchmark[key as keyof Benchmark] || 'null')
            .join('|')
    }, [activeCategoryFields])

    // Generate a readable label with full category names for the header
    const getCategoryLabelFull = useCallback((benchmark: Benchmark): string => {
        return activeCategoryFields
            .map(({key, name}) => {
                const value = benchmark[key as keyof Benchmark] || 'N/A'
                return `${name}: ${value}`
            })
            .join(' | ')
    }, [activeCategoryFields])

    // Generate a compact label with only values for charts
    const getCategoryLabelCompact = useCallback((benchmark: Benchmark): string => {
        return activeCategoryFields
            .map(({key}) => benchmark[key as keyof Benchmark] || 'N/A')
            .join(' | ')
    }, [activeCategoryFields])

    // Get all unique category combinations from filtered benchmarks
    const uniqueCategoryCombinations = useMemo(() => {
        const combinationsMap = new Map<string, { key: string; labelFull: string; labelCompact: string; sample: Benchmark }>()

        benchmarks.forEach(benchmark => {
            const key = getCategoryKey(benchmark)
            if (!combinationsMap.has(key)) {
                combinationsMap.set(key, {
                    key,
                    labelFull: getCategoryLabelFull(benchmark),
                    labelCompact: getCategoryLabelCompact(benchmark),
                    sample: benchmark
                })
            }
        })

        return Array.from(combinationsMap.values())
    }, [benchmarks, getCategoryKey, getCategoryLabelFull, getCategoryLabelCompact])

    // Prepare chart data for each value field
    const getChartDataForValue = useCallback((valueKey: string) => {
        // Group benchmarks by timestamp
        const timeStampMap = new Map<string, ChartDataPoint>()

        benchmarks.forEach(benchmark => {
            const timestamp = new Date(benchmark.timestamp).toLocaleString(undefined, {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric'
            });
            const categoryKey = getCategoryKey(benchmark)
            const value = benchmark[valueKey as keyof Benchmark] as number | null

            if (!timeStampMap.has(timestamp)) {
                timeStampMap.set(timestamp, {
                    timestamp,
                    fullTimestamp: benchmark.timestamp
                })
            }

            const dataPoint = timeStampMap.get(timestamp)!
            dataPoint[categoryKey] = value
        })

        return Array.from(timeStampMap.values())
    }, [benchmarks, getCategoryKey])

    // Calculate statistics for each category combination and value
    const calculateStats = useCallback((valueKey: string, categoryKey: string) => {
        const values = benchmarks
            .filter(b => getCategoryKey(b) === categoryKey)
            .map(b => b[valueKey as keyof Benchmark] as number | null)
            .filter((v): v is number => v !== null && v !== undefined)

        if (values.length === 0) return null

        const sum = values.reduce((a, b) => a + b, 0)
        const avg = sum / values.length
        const min = Math.min(...values)
        const max = Math.max(...values)
        const latest = values[values.length - 1]

        return {avg, min, max, latest, count: values.length}
    }, [benchmarks, getCategoryKey])

    // Generate colors for each category combination
    const generateColors = (count: number): string[] => {
        const baseColors = [
            '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1',
            '#a4de6c', '#d0ed57', '#ffc0cb', '#dda0dd', '#f0e68c',
            '#87ceeb', '#98fb98', '#deb887', '#cd5c5c', '#4682b4'
        ]

        const colors: string[] = []
        for (let i = 0; i < count; i++) {
            if (i < baseColors.length) {
                colors.push(baseColors[i])
            } else {
                // Generate additional colors using HSL
                const hue = (i * 137.508) % 360 // Golden angle
                colors.push(`hsl(${hue}, 70%, 60%)`)
            }
        }
        return colors
    }

    const categoryColors = useMemo(
        () => generateColors(uniqueCategoryCombinations.length),
        [uniqueCategoryCombinations.length]
    )

    return (
        <div className="benchmark-charts">
            <div className="header">
                <button onClick={onBack} className="back-button">
                    ← Back to Projects
                </button>
                <h1>{project.project}</h1>
                <p className="subtitle">Benchmark Analytics</p>
            </div>

            {!showCharts ? (
                <div className="category-selector">
                    <h2>Select Categories</h2>
                    <p>Choose values for each category to filter benchmarks</p>

                    {loading ? (
                        <div className="loading">Loading categories...</div>
                    ) : (
                        <>
                            <div className="category-filters">
                                {activeCategoryFields.map(({key, name}) => (
                                    <div key={key} className="filter-group">
                                        <label htmlFor={key}>{name}:</label>
                                        <select
                                            id={key}
                                            value={selectedCategories[key as keyof CategoryFilters] || ''}
                                            onChange={(e) => handleCategoryChange(key, e.target.value)}
                                        >
                                            <option value="">-- All --</option>
                                            {categories[key]?.map((value) => (
                                                <option key={value} value={value}>
                                                    {value}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            {/* Moved Show Charts button up under category selection */}
                            <div className="action-buttons">
                                <button
                                    onClick={handleShowCharts}
                                    className="primary-button"
                                    disabled={loading}
                                >
                                    Show Charts
                                </button>
                            </div>

                            {/* Recently Used and Example Filters */}
                            {(recentFilters.length > 0 || exampleFilters.length > 0) && (
                                <div className="suggested-filters">
                                    {recentFilters.length > 0 && (
                                        <div className="filter-suggestion-section">
                                            <h3>Recently Used</h3>
                                            <div className="filter-tags">
                                                {recentFilters.map((filters, index) => (
                                                    <button
                                                        key={index}
                                                        className="filter-tag-button"
                                                        onClick={() => applyFilterSet(filters)}
                                                        title={Object.entries(filters)
                                                            .map(([key, value]) => `${activeCategoryFields.find(f => f.key === key)?.name}: ${value}`)
                                                            .join(' | ')}
                                                    >
                                                        {Object.values(filters).join(' / ')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {exampleFilters.length > 0 && (
                                        <div className="filter-suggestion-section">
                                            <h3>Examples</h3>
                                            <div className="filter-tags">
                                                {exampleFilters.map((filters, index) => (
                                                    <button
                                                        key={index}
                                                        className="filter-tag-button"
                                                        onClick={() => applyFilterSet(filters)}
                                                        title={Object.entries(filters)
                                                            .map(([key, value]) => `${activeCategoryFields.find(f => f.key === key)?.name}: ${value}`)
                                                            .join(' | ')}
                                                    >
                                                        {Object.values(filters).join(' / ')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {error && <div className="error">{error}</div>}
                </div>
            ) : (
                <>
                    <div className="chart-header">
                        <div className="filter-summary">
                            <h2>Filtered Results</h2>
                            <div className="filter-tags">
                                {Object.entries(selectedCategories).map(([key, value]) => {
                                    const categoryName = activeCategoryFields.find(c => c.key === key)?.name
                                    return (
                                        <span key={key} className="filter-tag">
                      <strong>{categoryName}:</strong> {value}
                    </span>
                                    )
                                })}
                            </div>
                            <button onClick={handleResetFilters} className="secondary-button">
                                Reset All
                            </button>
                            <button onClick={handleChangeFilters} className="primary-button">
                                Change Filters
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading benchmark data...</div>
                    ) : error ? (
                        <div className="error-banner">{error}</div>
                    ) : benchmarks.length === 0 ? (
                        <div className="no-data">
                            <p>No benchmark data found for the selected filters.</p>
                            <button onClick={handleResetFilters} className="primary-button">
                                Try Different Filters
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Category Combinations Legend */}
                            {uniqueCategoryCombinations.length > 1 && (
                                <div className="category-legend">
                                    <h3>Category Combinations ({uniqueCategoryCombinations.length} total):</h3>
                                    <div className="legend-items">
                                        {uniqueCategoryCombinations.map((combo, index) => (
                                            <div key={combo.key} className="legend-item">
                                                <div
                                                    className="legend-color"
                                                    style={{backgroundColor: categoryColors[index]}}
                                                />
                                                <span className="legend-label">{combo.labelFull}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Charts for each value */}
                            {activeValueFields.map(({key: valueKey, name: valueName}) => {
                                const chartData = getChartDataForValue(valueKey)

                                return (
                                    <div key={valueKey} className="chart-section">
                                        <h2>{valueName}</h2>

                                        {/* Summary Statistics */}
                                        <div className="summary-section">
                                            <h3>Statistics by Category</h3>
                                            <div className="stats-grid">
                                                {uniqueCategoryCombinations.map((combo, index) => {
                                                    const stats = calculateStats(valueKey, combo.key)
                                                    if (!stats) return null

                                                    return (
                                                        <div key={combo.key} className="stat-card">
                                                            <div
                                                                className="stat-card-header"
                                                                style={{backgroundColor: categoryColors[index]}}
                                                            >
                                                                <h4>{combo.labelCompact}</h4>
                                                            </div>
                                                            <div className="stat-card-body">
                                                                <div className="stat-row">
                                                                    <span className="stat-label">Latest:</span>
                                                                    <span className="stat-value">{stats.latest.toLocaleString()}</span>
                                                                </div>
                                                                <div className="stat-row">
                                                                    <span className="stat-label">Average:</span>
                                                                    <span className="stat-value">{stats.avg.toFixed(2)}</span>
                                                                </div>
                                                                <div className="stat-row">
                                                                    <span className="stat-label">Min:</span>
                                                                    <span className="stat-value">{stats.min.toLocaleString()}</span>
                                                                </div>
                                                                <div className="stat-row">
                                                                    <span className="stat-label">Max:</span>
                                                                    <span className="stat-value">{stats.max.toLocaleString()}</span>
                                                                </div>
                                                                <div className="stat-row">
                                                                    <span className="stat-label">Count:</span>
                                                                    <span className="stat-value">{stats.count}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Line Chart */}
                                        <div className="chart-wrapper">
                                            <ResponsiveContainer width="100%" height={500}>
                                                <LineChart data={chartData} margin={{top: 5, right: 30, left: 20, bottom: 20}}>
                                                    <CartesianGrid strokeDasharray="3 3"/>
                                                    <XAxis
                                                        dataKey="timestamp"
                                                        angle={-45}
                                                        textAnchor="end"
                                                        height={50}
                                                        tick={{fontSize: 11}}
                                                    />
                                                    <YAxis/>
                                                    <Tooltip/>
                                                    {uniqueCategoryCombinations.map((combo, index) => (
                                                        <Line
                                                            key={combo.key}
                                                            type="monotone"
                                                            dataKey={combo.key}
                                                            stroke={categoryColors[index]}
                                                            name={combo.key}
                                                            strokeWidth={2}
                                                            dot={{r: 4}}
                                                            activeDot={{r: 6}}
                                                            connectNulls
                                                        />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )
                            })}
                        </>
                    )}
                </>
            )}
        </div>
    )
}
