import { useState, useEffect } from 'react'
import { ProjectSelector } from './components/ProjectSelector'
import { BenchmarkCharts } from './components/BenchmarkCharts'
import type { BenchmarkProjectMetadata } from './types/benchmark'
import './App.css'

function App() {
  const [selectedProject, setSelectedProject] = useState<BenchmarkProjectMetadata | null>(null)

  // Read project from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const projectName = params.get('project')

    if (projectName) {
      // Store the project name to be picked up by ProjectSelector
      sessionStorage.setItem('initialProject', projectName)
    }
  }, [])

  const handleProjectSelect = (project: BenchmarkProjectMetadata) => {
    setSelectedProject(project)

    // Update URL with project parameter
    const params = new URLSearchParams(window.location.search)
    params.set('project', project.project)

    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.pushState({}, '', newUrl)

    console.log('Selected project:', project)
  }

  const handleBackToProjects = () => {
    setSelectedProject(null)

    // Remove project and category params from URL
    const params = new URLSearchParams(window.location.search)
    params.delete('project')
    // Remove category filters
    for (let i = 1; i <= 5; i++) {
      params.delete(`category${i}`)
    }

    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    window.history.pushState({}, '', newUrl)
  }

  return (
    <>
      {!selectedProject ? (
        <ProjectSelector onProjectSelect={handleProjectSelect} />
      ) : (
        <BenchmarkCharts project={selectedProject} onBack={handleBackToProjects} />
      )}
    </>
  )
}

export default App
