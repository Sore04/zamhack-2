"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Star } from "lucide-react"
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
import { addSkill, removeSkill } from "@/app/(student)/profile/actions"
import { Database } from "@/types/supabase"

type ProficiencyLevel = Database["public"]["Enums"]["proficiency_level"]

type Skill = {
  id: string
  name: string
  category: string | null
}

type StudentSkill = {
  id: string
  level: ProficiencyLevel
  skill: Skill
}

type EarnedSkill = {
  id: string
  tier: "beginner" | "intermediate" | "advanced"
  source: "challenge" | "admin"
  awarded_at: string | null
  skill: Skill | null
  challenge: { id: string; title: string } | null
}

type Props = {
  studentId: string
  initialSkills: StudentSkill[]
  availableSkills: Skill[]
  earnedSkills: EarnedSkill[]
}

const LEVEL_LABELS: Record<ProficiencyLevel, string> = {
  beginner: "Beginner ⭐",
  intermediate: "Intermediate ⭐⭐",
  advanced: "Advanced ⭐⭐⭐",
}

const LEVEL_ORDER: ProficiencyLevel[] = ["beginner", "intermediate", "advanced"]

export const SkillsSection = ({ studentId, initialSkills, availableSkills, earnedSkills }: Props) => {
  const router = useRouter()
  const [skills, setSkills] = useState<StudentSkill[]>(initialSkills)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSkillId, setSelectedSkillId] = useState<string>("")
  const [selectedLevel, setSelectedLevel] = useState<ProficiencyLevel>("beginner")
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalCount = skills.length
  const addedSkillIds = new Set(skills.map((s) => s.skill.id))
  const filteredAvailable = availableSkills.filter((s) => !addedSkillIds.has(s.id))
  const countByLevel = (level: ProficiencyLevel) => skills.filter((s) => s.level === level).length

  // Group skills by category for the select
  const groupedAvailable = filteredAvailable.reduce<Record<string, Skill[]>>((acc, s) => {
    const cat = s.category ?? "Other"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  const handleOpenModal = () => {
    setError(null)
    setSelectedSkillId("")
    setSelectedLevel("beginner")
    setModalOpen(true)
  }

  const triggerRecompute = () => {
    fetch("/api/talent/recompute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    }).catch(console.error)
  }

  const handleAdd = async () => {
    if (!selectedSkillId) {
      setError("Please select a skill")
      return
    }
    if (totalCount >= 15) {
      setError("Maximum 15 skills allowed")
      return
    }
    if (countByLevel(selectedLevel) >= 5) {
      setError(`Maximum 5 ${selectedLevel} skills allowed`)
      return
    }

    setError(null)
    setAdding(true)
    const result = await addSkill(selectedSkillId, selectedLevel)
    setAdding(false)

    if (result.error) {
      setError(result.error)
      return
    }

    // Optimistic update with real ID from server
    const skill = availableSkills.find((s) => s.id === selectedSkillId)!
    setSkills((prev) => [
      ...prev,
      { id: result.id!, level: selectedLevel, skill },
    ])
    setModalOpen(false)
    triggerRecompute()
    router.refresh()
  }

  const handleRemove = async (studentSkillId: string) => {
    setRemoving(studentSkillId)
    // Optimistic remove
    setSkills((prev) => prev.filter((s) => s.id !== studentSkillId))
    const result = await removeSkill(studentSkillId)
    setRemoving(null)

    if (result.error) {
      // Revert
      setSkills(initialSkills)
      return
    }
    triggerRecompute()
    router.refresh()
  }

  const skillsByLevel = LEVEL_ORDER.reduce<Record<ProficiencyLevel, StudentSkill[]>>(
    (acc, level) => {
      acc[level] = skills.filter((s) => s.level === level)
      return acc
    },
    { beginner: [], intermediate: [], advanced: [] }
  )

  return (
    <>
      {/* Portfolio Skills Card */}
      <div className="pf-card">
        <div className="pf-card-header">
          <div className="pf-card-icon pf-card-icon-navy">
            <span style={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "-0.02em" }}>SK</span>
          </div>
          <h2 className="pf-card-title">Skills</h2>
          <button
            className="pf-skills-add-btn"
            onClick={handleOpenModal}
            disabled={totalCount >= 15 || filteredAvailable.length === 0}
          >
            <Plus size={13} />
            Add Skill
          </button>
        </div>
        <div className="pf-card-body">
          {skills.length === 0 ? (
            <p className="pf-empty">No skills added yet. Click "Add Skill" to add your first skill.</p>
          ) : (
            <div className="pf-skills-groups">
              {LEVEL_ORDER.map((level) => {
                const group = skillsByLevel[level]
                if (group.length === 0) return null
                return (
                  <div key={level} className="pf-skills-group">
                    <span className="pf-skills-level-label">{LEVEL_LABELS[level]}</span>
                    <div className="pf-skills-tags">
                      {group.map((s) => (
                        <span key={s.id} className={`pf-skill-tag pf-skill-tag-${level}`}>
                          {s.skill.name}
                          <button
                            className="pf-skill-remove"
                            onClick={() => handleRemove(s.id)}
                            disabled={removing === s.id}
                            aria-label={`Remove ${s.skill.name}`}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {totalCount > 0 && (
            <p className="pf-skills-count">{totalCount} / 15 skills</p>
          )}
        </div>
      </div>

      {/* Challenge-Verified Earned Skills Card */}
      <div id="earned-skills" className="pf-card">
        <div className="pf-card-header">
          <div className="pf-card-icon"><Star size={15} /></div>
          <h2 className="pf-card-title">Challenge-Verified Skills</h2>
        </div>
        <div className="pf-card-body">
          {earnedSkills.length === 0 ? (
            <p className="pf-empty">
              No earned skills yet. Complete challenges to earn verified skills that unlock gated challenges.
            </p>
          ) : (
            <>
              <p className="pf-skills-earned-desc">Skills earned by completing challenges. These unlock participation in gated challenges.</p>
              <div className="pf-skills-groups" style={{ marginTop: "0.75rem" }}>
                {(["beginner", "intermediate", "advanced"] as const).map((tier) => {
                  const group = earnedSkills.filter((s) => s.tier === tier && s.skill)
                  if (group.length === 0) return null
                  return (
                    <div key={tier} className="pf-skills-group">
                      <span className="pf-skills-level-label">{LEVEL_LABELS[tier as keyof typeof LEVEL_LABELS]}</span>
                      <div className="pf-skills-tags">
                        {group.map((s) => (
                          <span
                            key={s.id}
                            className={`pf-skill-tag pf-skill-tag-${tier}`}
                            title={s.source === "admin" ? "Granted by Admin" : s.challenge ? `Earned from: ${s.challenge.title}` : undefined}
                          >
                            {s.skill!.name}
                            {s.source === "admin" && (
                              <span style={{ fontSize: "0.65rem", opacity: 0.7, marginLeft: 3 }}>★</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Skill Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent style={{ maxWidth: 420 }}>
          <DialogHeader>
            <DialogTitle>Add a Skill</DialogTitle>
          </DialogHeader>

          <div className="pf-skills-modal-body">
            {error && <p className="pf-skills-error">{error}</p>}

            <div className="pf-skills-field">
              <label className="pf-skills-label">Skill</label>
              <Select value={selectedSkillId} onValueChange={setSelectedSkillId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a skill…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedAvailable)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([category, catSkills]) => (
                      catSkills.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {category !== "Other" && (
                            <span style={{ color: "#9ca3af", marginLeft: 4 }}>· {category}</span>
                          )}
                        </SelectItem>
                      ))
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pf-skills-field">
              <label className="pf-skills-label">Proficiency Level</label>
              <Select
                value={selectedLevel}
                onValueChange={(v) => setSelectedLevel(v as ProficiencyLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner ⭐</SelectItem>
                  <SelectItem value="intermediate">Intermediate ⭐⭐</SelectItem>
                  <SelectItem value="advanced">Advanced ⭐⭐⭐</SelectItem>
                </SelectContent>
              </Select>
              {countByLevel(selectedLevel) >= 5 && (
                <p className="pf-skills-warn">You&apos;ve reached the 5-skill limit for this level.</p>
              )}
              <p className="pf-skills-hint">
                {5 - countByLevel(selectedLevel)} slot{5 - countByLevel(selectedLevel) !== 1 ? "s" : ""} remaining at this level · {15 - totalCount} total remaining
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={adding || !selectedSkillId || countByLevel(selectedLevel) >= 5}
            >
              {adding ? "Adding…" : "Add Skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
