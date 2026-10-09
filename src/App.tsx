import { Navigate, Route, Routes } from "react-router";
import StoryLayout from "@/components/editor/StoryLayout";
import StoryPlayerTool from "@/components/player/StoryPlayerTool";
import Save from "@/pages/Save";
import View from "@/pages/View";
import Info from "@/pages/Info";
import Home from "@/pages/Home";
import Edit from "@/pages/Edit";
import Preview from "@/pages/Preview";
import Birthdays from "@/pages/Birthdays";
import Live2DTest from "@/pages/Live2DTest";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/birthdays" element={<Birthdays />} />
      <Route path="/play" element={<StoryPlayerTool locale="en-US" stories={[]} />} />
      <Route path="/live2d-test" element={<Live2DTest />} />
      <Route path="/story/:id/view" element={<View />} />
      <Route path="/story/:id" element={<StoryLayout />}>
        <Route index element={<Navigate to="info" replace />} />
        <Route path="info" element={<Info />} />
        <Route path="edit" element={<Edit />} />
        <Route path="preview" element={<Preview />} />
        <Route path="save" element={<Save />} />
      </Route>
    </Routes>
  );
}