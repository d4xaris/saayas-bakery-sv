import { Route, Routes } from "react-router";
import StoryPlayerTool from "@/components/player/StoryPlayerTool";
import Home from "@/pages/Home";
import Info from "@/pages/Info";

const Stub = ({ name }: { name: string }) => <div className="p-6">{name}</div>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play" element={<StoryPlayerTool locale="en-US" stories={[]} />} />
      <Route path="/story/:id/info" element={<Info />} />
      <Route path="/story/:id/edit" element={<Stub name="Edit" />} />
      <Route path="/story/:id/preview" element={<Stub name="Preview" />} />
      <Route path="/story/:id/save" element={<Stub name="Save" />} />
    </Routes>
  );
}