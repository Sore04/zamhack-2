// src/app/api/payment/create-checkout/route.ts

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth Check ─────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be logged in to register." },
        { status: 401 }
      )
    }

    // ── 2. Parse Request Body ──────────────────────────────────
    const { challengeId } = await req.json()

    if (!challengeId) {
      return NextResponse.json(
        { error: "Challenge ID is required." },
        { status: 400 }
      )
    }

    // ── 3. Fetch Challenge ─────────────────────────────────────
    const { data: challenge, error: challengeError } = await supabase
      .from("challenges")
      .select("id, title, entry_fee_amount, currency, status, registration_deadline")
      .eq("id", challengeId)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json(
        { error: "Challenge not found." },
        { status: 404 }
      )
    }

    // ── 4. Validate Challenge is Open ──────────────────────────
    if (challenge.status !== "approved" && challenge.status !== "in_progress") {
      return NextResponse.json(
        { error: "This challenge is not open for registration." },
        { status: 400 }
      )
    }

    if (challenge.registration_deadline) {
      const deadline = new Date(challenge.registration_deadline)
      if (new Date() > deadline) {
        return NextResponse.json(
          { error: "Registration deadline has passed." },
          { status: 400 }
        )
      }
    }

    // ── 5. Check if Already Joined ─────────────────────────────
    const { data: existingParticipant } = await supabase
      .from("challenge_participants")
      .select("id")
      .eq("user_id", user.id)
      .eq("challenge_id", challengeId)
      .single()

    if (existingParticipant) {
      return NextResponse.json(
        { error: "You have already joined this challenge." },
        { status: 400 }
      )
    }

    // ── 6. Check for Existing Pending Payment ─────────────────
    // Prevents duplicate checkout sessions being created
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, status, checkout_session_id")
      .eq("user_id", user.id)
      .eq("challenge_id", challengeId)
      .eq("status", "pending")
      .single()

    // ── 7. Determine Fee Amount ────────────────────────────────
    // PayMongo requires amount in centavos (multiply by 100)
    // e.g. ₱100.00 → 10000 centavos
    const feeInPesos = challenge.entry_fee_amount ?? 100
    const amountInCentavos = Math.round(feeInPesos * 100)
    const currency = (challenge.currency ?? "PHP").toUpperCase()

    // ── 8. Build Redirect URLs ─────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
      || process.env.NEXT_PUBLIC_VERCEL_URL
      || "http://localhost:3000"

    const successUrl = `${baseUrl}/challenges/${challengeId}/payment/success`
    const cancelUrl  = `${baseUrl}/challenges/${challengeId}/payment/failed`

    // ── 9. Create PayMongo Checkout Session ───────────────────
    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY
    if (!paymongoSecretKey) {
      console.error("PAYMONGO_SECRET_KEY is not set")
      return NextResponse.json(
        { error: "Payment service is not configured." },
        { status: 500 }
      )
    }

    const paymongoResponse = await fetch(
      "https://api.paymongo.com/v1/checkout_sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${Buffer.from(paymongoSecretKey + ":").toString("base64")}`,
        },
        body: JSON.stringify({
          data: {
            attributes: {
              billing: {
                email: user.email,
              },
              line_items: [
                {
                  currency,
                  amount: amountInCentavos,
                  name: `Registration Fee — ${challenge.title}`,
                  quantity: 1,
                },
              ],
              payment_method_types: ["card", "gcash", "paymaya", "qrph"],
              success_url: successUrl,
              cancel_url: cancelUrl,
              // Pass metadata so our webhook knows which challenge + user this is for
              metadata: {
                challenge_id: challengeId,
                user_id: user.id,
                payment_type: "student_entry",
              },
              description: `ZamHack registration fee for: ${challenge.title}`,
            },
          },
        }),
      }
    )

    if (!paymongoResponse.ok) {
      const errorData = await paymongoResponse.json()
      console.error("PayMongo error:", errorData)
      return NextResponse.json(
        { error: "Failed to create payment session. Please try again." },
        { status: 500 }
      )
    }

    const paymongoData = await paymongoResponse.json()
    const session    = paymongoData.data
    const checkoutUrl = session.attributes.checkout_url
    const sessionId   = session.id

    // ── 10. Save Payment Record to DB ─────────────────────────
    // If there was already a pending payment, update it.
    // Otherwise insert a fresh one.
    if (existingPayment) {
      await supabase
        .from("payments")
        .update({
          checkout_session_id: sessionId,
          amount: amountInCentavos,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPayment.id)
    } else {
      const { error: insertError } = await supabase
        .from("payments")
        .insert({
          user_id: user.id,
          challenge_id: challengeId,
          amount: amountInCentavos,
          currency,
          status: "pending",
          provider: "paymongo",
          checkout_session_id: sessionId,
          payment_type: "student_entry",
        })

      if (insertError) {
        console.error("Failed to save payment record:", insertError)
        // Don't block the user — the webhook will handle confirmation
      }
    }

    // ── 11. Return Checkout URL to Client ──────────────────────
    return NextResponse.json({ checkout_url: checkoutUrl }, { status: 200 })

  } catch (err) {
    console.error("create-checkout error:", err)
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    )
  }
}