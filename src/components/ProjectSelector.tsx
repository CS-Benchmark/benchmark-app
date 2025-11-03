import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { BenchmarkProjectMetadata } from '../types/benchmark'
import './ProjectSelector.css'

interface ProjectSelectorProps {
  onProjectSelect: (project: BenchmarkProjectMetadata) => void
}

export function ProjectSelector({ onProjectSelect }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<BenchmarkProjectMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('benchmark_project_metadata')
        .select('*')
        .order('project', { ascending: true })

      if (error) throw error

      setProjects(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Error fetching projects:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="project-selector">
        <div className="loading">Loading projects...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="project-selector">
        <div className="error">
          <h2>Error Loading Projects</h2>
          <p>{error}</p>
          <button onClick={fetchProjects}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="project-selector">
      <h1>Select a Benchmark Project</h1>
      <p className="subtitle">Choose a project to view its benchmark information</p>

      {projects.length === 0 ? (
        <div className="no-projects">
          <p>No projects found in the database.</p>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              onClick={() => onProjectSelect(project)}
            >
              <h3>{project.project}</h3>
              <div className="project-details">
                {project.category1_name && (
                  <span className="badge">📊 {project.category1_name}</span>
                )}
                {project.value1_name && (
                  <span className="badge">📈 {project.value1_name}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
