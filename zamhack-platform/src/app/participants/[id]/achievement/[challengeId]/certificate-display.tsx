"use client"

import CompletionCertificate from "@/components/certificate/certificate-template"
import WinnerCertificate from "@/components/certificate/winner-certificate-template"

interface Props {
  type: "completion" | "winner"
  rank?: 1 | 2 | 3
  studentName: string
  challengeTitle: string
  organizationName: string
  completionDate: string
  totalScore?: number | null
  representativeName?: string | null
  signatureUrl?: string | null
  verifyUrl?: string | null
}

export default function CertificateDisplay(props: Props) {
  return (
    <div style={{ width: "100%", overflowX: "hidden", display: "flex", justifyContent: "center" }}>
      {/* Native 1056×748px certificate scaled down to fit viewport */}
      <div
        style={{
          transform: "scale(0.65)",
          transformOrigin: "top center",
          width: "1056px",
          height: "748px",
          flexShrink: 0,
          marginBottom: "-262px",
        }}
      >
        {props.type === "winner" && props.rank !== undefined ? (
          <WinnerCertificate
            studentName={props.studentName}
            challengeTitle={props.challengeTitle}
            organizationName={props.organizationName}
            awardDate={props.completionDate}
            rank={props.rank}
            score={props.totalScore ?? undefined}
            representativeName={props.representativeName}
            signatureUrl={props.signatureUrl}
            verifyUrl={props.verifyUrl}
          />
        ) : (
          <CompletionCertificate
            studentName={props.studentName}
            challengeTitle={props.challengeTitle}
            organizationName={props.organizationName}
            completionDate={props.completionDate}
            totalScore={props.totalScore}
            representativeName={props.representativeName}
            signatureUrl={props.signatureUrl}
            verifyUrl={props.verifyUrl}
          />
        )}
      </div>
    </div>
  )
}
