import { Route, Routes } from "react-router";
import StoryPlayerTool from "@/components/player/StoryPlayerTool";

function Play() {
  return <StoryPlayerTool locale="en-US" stories={[]} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div className="p-6">Home</div>} />
      <Route path="/play" element={<Play />} />
    </Routes>
  );
}