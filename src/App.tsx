import { useState } from 'react'
import { ProjectSelector } from './components/ProjectSelector'
import { BenchmarkCharts } from './components/BenchmarkCharts'
import type { BenchmarkProjectMetadata } from './types/benchmark'
import './App.css'

function App() {
  const [selectedProject, setSelectedProject] = useState<BenchmarkProjectMetadata | null>(null)

  const handleProjectSelect = (project: BenchmarkProjectMetadata) => {
    setSelectedProject(project)
    console.log('Selected project:', project)
  }

  const handleBackToProjects = () => {
    setSelectedProject(null)
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
