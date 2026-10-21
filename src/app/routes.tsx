import { createBrowserRouter, Navigate } from "react-router";
import type { ComponentType } from "react";

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter([
  { path: "/", lazy: page(() => import("@/routes/Home")) },
  { path: "/birthdays", lazy: page(() => import("@/routes/Birthdays")) },
  { path: "/story/:id/view", lazy: page(() => import("@/routes/View")) },
  {
    path: "/story/:id",
    lazy: page(() => import("@/editor/components/StoryLayout")),
    children: [
      { index: true, element: <Navigate to="info" replace /> },
      { path: "info", lazy: page(() => import("@/routes/Info")) },
      { path: "edit", lazy: page(() => import("@/routes/Edit")) },
      { path: "preview", lazy: page(() => import("@/routes/Preview")) },
      { path: "save", lazy: page(() => import("@/routes/Save")) },
    ],
  },
]);