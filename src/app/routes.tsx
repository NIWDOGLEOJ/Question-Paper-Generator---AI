import { createBrowserRouter } from "react-router";
import { Layout } from "./Layout";
import { Dashboard } from "./pages/Dashboard";
import { Generate } from "./pages/Generate";
import { ViewPaper } from "./pages/ViewPaper";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "new", Component: Generate },
      { path: "paper/:id", Component: ViewPaper },
    ],
  },
]);
