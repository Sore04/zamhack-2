"use client"

import { useRef, useState } from "react"
import { uploadAvatar } from "@/app/(student)/profile/avatar-actions"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface AvatarUploadProps {
  currentUrl: string | null
  initials: string
  onUpload?: (newUrl: string) => void
}

export function AvatarUpload({ currentUrl, initials, onUpload }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    setUploading(true)
    const formData = new FormData()
    formData.append("avatar", file)

    const result = await uploadAvatar(formData)

    if (result.error) {
      toast.error(result.error)
      setPreview(currentUrl) // revert preview on error
    } else if (result.avatarUrl) {
      toast.success("Profile photo updated!")
      setPreview(result.avatarUrl)
      onUpload?.(result.avatarUrl)
    }

    setUploading(false)
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="relative inline-block">
      {/* Avatar display */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          border: "4px solid #fff",
          overflow: "hidden",
          background: "linear-gradient(135deg, #ff9b87, #e8836f)",
          boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Profile"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-outfit, Outfit, sans-serif)",
            fontSize: "1.5rem", fontWeight: 700, color: "#fff",
          }}>
            {initials}
          </div>
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Loader2 size={22} color="#fff" className="animate-spin" />
          </div>
        )}
      </div>

      {/* Camera button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Change profile photo"
        style={{
          position: "absolute",
          bottom: -4,
          right: -4,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "#2c3e50",
          border: "2px solid #fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,.2)",
        }}
      >
        <Camera size={13} color="#fff" />
      </button>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  )
}