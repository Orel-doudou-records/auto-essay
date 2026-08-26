import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "@/routes/HomePage";
import { ProjectPage } from "@/routes/ProjectPage";
import { SourcesPage } from "@/routes/SourcesPage";
import { EditorPage } from "@/routes/EditorPage";
import { EvaluatePage } from "@/routes/EvaluatePage";
import { DemoPage } from "@/routes/DemoPage";
import { AuthorWorkshopPage } from "@/routes/AuthorWorkshopPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/projects/:projectId/sources" element={<SourcesPage />} />
        <Route path="/projects/:projectId/editor" element={<EditorPage />} />
        <Route path="/projects/:projectId/atelier" element={<AuthorWorkshopPage />} />
        <Route path="/projects/:projectId/evaluate/:unitId" element={<EvaluatePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
