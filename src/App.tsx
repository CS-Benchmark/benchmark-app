import { useState } from 'react'
import { ProjectSelector } from './components/ProjectSelector'
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
        <div className="benchmark-view">
          <button onClick={handleBackToProjects} className="back-button">
            ← Back to Projects
          </button>
          <h1>Benchmark Information</h1>
          <h2>{selectedProject.project}</h2>
          <div className="project-info">
            <h3>Categories:</h3>
            <ul>
              {selectedProject.category1_name && <li>{selectedProject.category1_name}</li>}
              {selectedProject.category2_name && <li>{selectedProject.category2_name}</li>}
              {selectedProject.category3_name && <li>{selectedProject.category3_name}</li>}
              {selectedProject.category4_name && <li>{selectedProject.category4_name}</li>}
              {selectedProject.category5_name && <li>{selectedProject.category5_name}</li>}
            </ul>
            <h3>Values:</h3>
            <ul>
              {selectedProject.value1_name && <li>{selectedProject.value1_name}</li>}
              {selectedProject.value2_name && <li>{selectedProject.value2_name}</li>}
              {selectedProject.value3_name && <li>{selectedProject.value3_name}</li>}
              {selectedProject.value4_name && <li>{selectedProject.value4_name}</li>}
              {selectedProject.value5_name && <li>{selectedProject.value5_name}</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

export default App
