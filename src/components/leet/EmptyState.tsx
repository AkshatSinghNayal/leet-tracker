"use client";

import { Database } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center mb-4">
        <Database className="w-6 h-6 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">No sheets yet</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Click <span className="text-foreground font-medium">&ldquo;New sheet&rdquo;</span> above to upload your first CSV.
        The CSV must have headers:
        <code className="mx-1 text-xs bg-muted px-1 py-0.5 rounded">ID, URL, Title, Difficulty</code>
      </p>
    </div>
  );
}
