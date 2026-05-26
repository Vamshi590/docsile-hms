"use client"

import { useState } from "react"
import { Plus, Pencil, Settings2, Trash2, MapPin, FlaskConical } from "lucide-react"
import { usePermissions } from "@/hooks/usePermissions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SectionHeader } from "@/components/layout/header"
import { deleteLab } from "../actions"
import { LabForm } from "./LabForm"
import { LabInvestigationConfig } from "./LabInvestigationConfig"
import { toast } from "sonner"
import type { LabWithCount } from "./LabsPage"

export function LabConfigTab({ initialLabs, loading, onLabsChanged }: {
  initialLabs: LabWithCount[]
  loading: boolean
  onLabsChanged?: () => void
}) {
  const { can } = usePermissions()
  const [formOpen, setFormOpen] = useState(false)
  const [editingLab, setEditingLab] = useState<LabWithCount | null>(null)
  const [configuringLab, setConfiguringLab] = useState<string | null>(null)
  const [deletingLab, setDeletingLab] = useState<LabWithCount | null>(null)

  async function handleDelete() {
    if (!deletingLab) return
    const result = await deleteLab(deletingLab.id)
    if (result.success) {
      toast.success("Lab deleted")
      onLabsChanged?.()
    } else {
      toast.error(result.error)
    }
    setDeletingLab(null)
  }

  // Show investigation config full view
  if (configuringLab) {
    return (
      <LabInvestigationConfig
        labId={configuringLab}
        onBack={() => { setConfiguringLab(null); onLabsChanged?.() }}
      />
    )
  }

  return (
    <>
      <SectionHeader title="Lab Configuration" description="Manage labs and their investigation mappings">
        {can("labs:config") && (
          <Button size="sm" onClick={() => { setEditingLab(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Add Lab
          </Button>
        )}
      </SectionHeader>

      {/* Labs Table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead>Lab Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-center">Investigations</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : initialLabs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                  <FlaskConical className="h-9 w-9 mx-auto mb-3 opacity-40" />
                  <div className="font-medium">No labs configured yet</div>
                  <div className="text-xs mt-1">Add your first lab to get started</div>
                </TableCell>
              </TableRow>
            ) : (
              initialLabs.map((lab) => (
                <TableRow key={lab.id}>
                  <TableCell>
                    <span className="font-medium">{lab.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{lab.description || "—"}</span>
                  </TableCell>
                  <TableCell>
                    {lab.location ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {lab.location}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-mono">
                      {lab._count.investigations}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={lab.isActive ? "success" : "secondary"}>
                      {lab.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {can("labs:config") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfiguringLab(lab.id)}
                          className="text-xs"
                        >
                          <Settings2 className="h-3.5 w-3.5 mr-1" /> Configure
                        </Button>
                      )}
                      {can("labs:config") && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7"
                          onClick={() => { setEditingLab(lab); setFormOpen(true) }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {can("labs:config") && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeletingLab(lab)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && initialLabs.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {initialLabs.length} lab{initialLabs.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <LabForm
        open={formOpen}
        lab={editingLab}
        onClose={() => { setFormOpen(false); setEditingLab(null) }}
        onSuccess={() => {
          setFormOpen(false)
          setEditingLab(null)
          onLabsChanged?.()
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingLab} onOpenChange={() => setDeletingLab(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lab</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingLab?.name}</strong>? This cannot be undone.
              Labs with existing bills cannot be deleted — deactivate them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
