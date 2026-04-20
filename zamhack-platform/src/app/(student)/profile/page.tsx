import { createClient } from "@/utils/supabase/server"
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog"
import { SkillsSection } from "@/components/profile/skills-section"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { Github, Linkedin, FileText, GraduationCap, BookOpen, ExternalLink } from "lucide-react"
import { XpCard } from "@/components/profile/xp-card"
import { AvatarUpload } from "@/components/avatar-upload"

// ── Types ─────────────────────────────────────────────────────────────────────
type Profile = Database["public"]["Tables"]["profiles"]["Row"]

// ── Data fetching ──────────────────────────────────────────────────────────────
async function getProfileData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/login")
  }

  const [
    { data: profile },
    { data: studentSkillsRaw },
    { data: allSkills },
    { data: earnedSkillsRaw },
    { data: xpSettings },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),

    supabase
      .from("student_skills")
      .select("id, level, skill:skills(id, name, category)")
      .eq("profile_id", user.id),

    supabase
      .from("skills")
      .select("id, name, category")
      .order("name"),

    (supabase
      .from("student_earned_skills")
      .select("id, tier, source, awarded_at, skill:skills(id, name, category), challenge:challenges(id, title)")
      .eq("profile_id", user.id)
      .order("awarded_at", { ascending: false }) as any),

    supabase
      .from("platform_settings")
      .select("xp_score_threshold, xp_penalty, xp_base_min, xp_base_max")
      .single(),
  ])

  return {
    profile: profile as Profile | null,
    user,
    xpSettings: xpSettings as Record<string, number> | null,
    studentSkills: (studentSkillsRaw ?? []) as Array<{
      id: string
      level: Database["public"]["Enums"]["proficiency_level"]
      skill: { id: string; name: string; category: string | null }
    }>,
    allSkills: (allSkills ?? []) as Array<{ id: string; name: string; category: string | null }>,
    earnedSkills: (earnedSkillsRaw ?? []) as Array<{
      id: string
      tier: "beginner" | "intermediate" | "advanced"
      source: "challenge" | "admin"
      awarded_at: string | null
      skill: { id: string; name: string; category: string | null } | null
      challenge: { id: string; title: string } | null
    }>,
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────────
const getInitials = (firstName: string | null, lastName: string | null): string => {
  const first = firstName?.charAt(0).toUpperCase() || ""
  const last  = lastName?.charAt(0).toUpperCase()  || ""
  return first + last || "U"
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function ProfilePage() {
  const { profile, user, xpSettings, studentSkills, allSkills, earnedSkills } = await getProfileData()

  const fullName = profile
    ? [profile.first_name, (profile as any).middle_name, profile.last_name]
      .filter(Boolean)
      .join(" ") || "User"
    : "User"

  const headline = profile
    ? [profile.university, profile.degree].filter(Boolean).join(" • ") || "No education information"
    : "No education information"

  const initials = getInitials(profile?.first_name || null, profile?.last_name || null)

  const socialLinks = [
    { href: profile?.github_url,   label: "GitHub",   icon: Github   },
    { href: profile?.linkedin_url, label: "LinkedIn",  icon: Linkedin },
    { href: profile?.resume_link,  label: "Resume",    icon: FileText },
  ].filter((l) => Boolean(l.href))

  return (
    <div className="pf-page">

      {/* ── Hero card ──────────────────────────────────────────────────── */}
      <div className="pf-hero">
        <div className="pf-hero-banner" />

        <div className="pf-hero-body">
          {/* Avatar */}
          <AvatarUpload
            currentUrl={profile?.avatar_url ?? null}
            initials={initials}
          />

          {/* Identity + edit button */}
          <div className="pf-hero-info">
            <div className="pf-hero-name-row">
              <div>
                <h1 className="pf-name">{fullName}</h1>
                <p className="pf-headline">{headline}</p>
              </div>
              <EditProfileDialog profile={profile} />
            </div>

            {socialLinks.length > 0 && (
              <div className="pf-social-row">
                {socialLinks.map(({ href, label, icon: Icon }) => (
                  <a
                    key={label}
                    href={href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pf-social-pill"
                  >
                    <Icon size={13} />
                    {label}
                    <ExternalLink size={11} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content grid ───────────────────────────────────────────────── */}
      <div className="pf-grid">

        {/* ── Left column ────────────────────────────────────────────── */}
        <div className="pf-col">

          {/* XP Rank */}
          <XpCard
            xpPoints={(profile as any)?.xp_points ?? 0}
            xpRank={(profile as any)?.xp_rank ?? "beginner"}
            scoreThreshold={(xpSettings as any)?.xp_score_threshold ?? 70}
            penalty={(xpSettings as any)?.xp_penalty ?? 50}
            baseMin={(xpSettings as any)?.xp_base_min ?? 50}
            baseMax={(xpSettings as any)?.xp_base_max ?? 400}
          />

          {/* About Me */}
          <div className="pf-card">
            <div className="pf-card-header">
              <div className="pf-card-icon">
                <BookOpen size={15} />
              </div>
              <h2 className="pf-card-title">About Me</h2>
            </div>
            <div className="pf-card-body">
              {profile?.bio ? (
                <p className="pf-bio">{profile.bio}</p>
              ) : (
                <p className="pf-empty">No bio added yet. Click Edit Profile to add one.</p>
              )}
            </div>
          </div>

          {/* Social Links (full list) */}
          <div className="pf-card">
            <div className="pf-card-header">
              <div className="pf-card-icon pf-card-icon-navy">
                <ExternalLink size={15} />
              </div>
              <h2 className="pf-card-title">Social Links</h2>
            </div>
            <div className="pf-links-list">
              {/* GitHub */}
              {profile?.github_url ? (
                <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="pf-link-row">
                  <div className="pf-link-icon"><Github size={15} /></div>
                  <span className="pf-link-label">GitHub</span>
                  <ExternalLink size={12} className="pf-link-arrow" />
                </a>
              ) : (
                <div className="pf-link-row pf-link-empty">
                  <div className="pf-link-icon"><Github size={15} /></div>
                  <span className="pf-link-label pf-empty">No GitHub link added</span>
                </div>
              )}

              {/* LinkedIn */}
              {profile?.linkedin_url ? (
                <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="pf-link-row">
                  <div className="pf-link-icon"><Linkedin size={15} /></div>
                  <span className="pf-link-label">LinkedIn</span>
                  <ExternalLink size={12} className="pf-link-arrow" />
                </a>
              ) : (
                <div className="pf-link-row pf-link-empty">
                  <div className="pf-link-icon"><Linkedin size={15} /></div>
                  <span className="pf-link-label pf-empty">No LinkedIn link added</span>
                </div>
              )}

              {/* Resume */}
              {profile?.resume_link ? (
                <a href={profile.resume_link} target="_blank" rel="noopener noreferrer" className="pf-link-row">
                  <div className="pf-link-icon"><FileText size={15} /></div>
                  <span className="pf-link-label">Resume</span>
                  <ExternalLink size={12} className="pf-link-arrow" />
                </a>
              ) : (
                <div className="pf-link-row pf-link-empty">
                  <div className="pf-link-icon"><FileText size={15} /></div>
                  <span className="pf-link-label pf-empty">No resume link added</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Right column ───────────────────────────────────────────── */}
        <div className="pf-col">

          {/* Education */}
          <div className="pf-card">
            <div className="pf-card-header">
              <div className="pf-card-icon pf-card-icon-navy">
                <GraduationCap size={15} />
              </div>
              <h2 className="pf-card-title">Education</h2>
            </div>
            <div className="pf-card-body">
              {profile?.university || profile?.degree || profile?.graduation_year ? (
                <div className="pf-edu-block">
                  {profile?.university && (
                    <div className="pf-edu-row">
                      <span className="pf-edu-label">University</span>
                      <span className="pf-edu-value">{profile.university}</span>
                    </div>
                  )}
                  {profile?.degree && (
                    <div className="pf-edu-row">
                      <span className="pf-edu-label">Degree</span>
                      <span className="pf-edu-value">{profile.degree}</span>
                    </div>
                  )}
                  {profile?.graduation_year && (
                    <div className="pf-edu-row">
                      <span className="pf-edu-label">Graduation Year</span>
                      <span className="pf-edu-value">{profile.graduation_year}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="pf-empty">No education information added yet.</p>
              )}
            </div>
          </div>

          {/* Skills (portfolio + earned) */}
          <SkillsSection
            studentId={user.id}
            initialSkills={studentSkills}
            availableSkills={allSkills}
            earnedSkills={earnedSkills}
          />

        </div>
      </div>
    </div>
  )
}
