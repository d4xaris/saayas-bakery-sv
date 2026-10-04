import { Routes, Route, Link } from 'react-router'

function Home() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Story Editor</h1>
      <Link to="/play" className="text-blue-400 underline">Open story player test</Link>
    </div>
  )
}

function Play() {
  return <div className="p-6">Player goes here</div>
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<Play />} />
      </Routes>
    </div>
  )
}