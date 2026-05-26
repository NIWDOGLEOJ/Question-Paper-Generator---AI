import { createBrowserRouter } from "react-router";
import { Layout } from "./Layout";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import { Generate } from "./pages/Generate";
import { ViewPaper } from "./pages/ViewPaper";
import { SourceMaterialPage } from "./pages/SourceMaterial";
import { SettingsPage } from "./pages/Settings";
import { ModelsPage } from "./pages/Models";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true,        Component: Home },
      { path: "papers",     Component: Dashboard },
      { path: "new",        Component: Generate },
      { path: "paper/:id",  Component: ViewPaper },
      { path: "sources",    Component: SourceMaterialPage },
      { path: "models",     Component: ModelsPage },
      { path: "settings",   Component: SettingsPage },
    ],
  },
]);
