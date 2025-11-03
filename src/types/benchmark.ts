export interface BenchmarkProjectMetadata {
  id: number
  project: string
  category1_name: string | null
  category2_name: string | null
  category3_name: string | null
  category4_name: string | null
  category5_name: string | null
  value1_name: string | null
  value2_name: string | null
  value3_name: string | null
  value4_name: string | null
  value5_name: string | null
}

export interface Benchmark {
  id: number
  project: string
  timestamp: string
  category1: string | null
  category2: string | null
  category3: string | null
  category4: string | null
  category5: string | null
  value1: number | null
  value2: number | null
  value3: number | null
  value4: number | null
  value5: number | null
  commit: string | null
}

export interface CategoryFilters {
  category1?: string
  category2?: string
  category3?: string
  category4?: string
  category5?: string
}
