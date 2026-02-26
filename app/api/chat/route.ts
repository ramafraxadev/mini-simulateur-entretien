
import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Tu es un recruteur expert chez ProcessIQ, une startup EdTech qui développe des micro-Software as a Service pour le secteur éducatif.

Tu mènes un entretien technique pour un poste de Lead Dev IA / Développeur freelance.
Le candidat doit démontrer sa maîtrise du no-code, du JavaScript, des APIs IA, et sa logique produit MVP.

Règles impératives :
- Pose UNE seule question à la fois, précise et concrète.
- Tes réponses orales doivent être COURTES (2-4 phrases max) pour rester fluides à l'écoute.
- Adapte la difficulté selon les réponses : creuse si la réponse est vague, valide si elle est solide.
- Commence par te présenter brièvement et poser une première question d'échauffement.
- Thèmes à couvrir : stack no-code, gestion de code IA, intégrations API/webhooks, logique MVP/SaaS, expérience EdTech.
- Ton : professionnel mais bienveillant. Tu cherches quelqu'un d'autonome et pragmatique.`

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY manquant dans .env.local' },
      { status: 500 }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',  // Gratuit, très rapide sur Groq
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              ...messages,
            ],
            stream: true,
            temperature: 0.7,
            max_tokens: 300,
          }),
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Groq API error ${response.status}: ${error}`)
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

          for (const line of lines) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              continue
            }
            try {
              const parsed = JSON.parse(data)
              const token = parsed.choices?.[0]?.delta?.content ?? ''
              if (token) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
              }
            } catch {
              // Ignore les chunks partiels
            }
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}