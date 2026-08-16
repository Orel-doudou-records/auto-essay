import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function App() {
  const [health, setHealth] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.status))
      .catch(() => setHealth("offline"));
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>auto-essay beta</CardTitle>
          <CardDescription>
            Interface graphique locale pour le moteur essayistique.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            État de l'API : {" "}
            <span className="font-medium text-foreground">{health ?? "…"}</span>
          </p>
          <Button onClick={() => window.location.reload()}>Rafraîchir</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
