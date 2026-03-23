"use client"

import { useState } from "react"
import { grantEarnedSkill } from "@/app/admin/actions"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Star } from "lucide-react"

interface Skill {
  id: string
  name: string
  category: string | null
}

interface GrantSkillButtonProps {
  userId: string
  role: string | null
  skills: Skill[]
}

export function GrantSkillButton({ userId, role, skills }: GrantSkillButtonProps) {
  const [open, setOpen] = useState(false)
  const [selectedSkillId, setSelectedSkillId] = useState("")
  const [selectedTier, setSelectedTier] = useState<"beginner" | "intermediate" | "advanced">("beginner")
  const [loading, setLoading] = useState(false)

  // Only show for students
  if (role !== "student") return null

  const handleGrant = async () => {
    if (!selectedSkillId) return
    setLoading(true)
    const result = await grantEarnedSkill(userId, selectedSkillId, selectedTier)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Skill granted successfully")
      setOpen(false)
      setSelectedSkillId("")
      setSelectedTier("beginner")
    }
  }

  return (
    <>
      <button
        className="admin-btn admin-btn-sm admin-btn-outline"
        style={{ color: "#7c3aed", borderColor: "#c4b5fd" }}
        onClick={() => setOpen(true)}
        title="Grant a skill credential to this student"
      >
        <Star style={{ width: 13, height: 13 }} />
        Grant Skill
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle>Grant Skill Credential</DialogTitle>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.5rem 0" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem", color: "#374151" }}>
                Skill
              </label>
              <Select value={selectedSkillId} onValueChange={setSelectedSkillId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a skill…" />
                </SelectTrigger>
                <SelectContent>
                  {skills.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.category && (
                        <span style={{ color: "#9ca3af", marginLeft: 4 }}>· {s.category}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem", color: "#374151" }}>
                Tier
              </label>
              <Select value={selectedTier} onValueChange={(v) => setSelectedTier(v as typeof selectedTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner ⭐</SelectItem>
                  <SelectItem value="intermediate">Intermediate ⭐⭐</SelectItem>
                  <SelectItem value="advanced">Advanced ⭐⭐⭐</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleGrant} disabled={loading || !selectedSkillId}>
              {loading ? "Granting…" : "Grant Skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
