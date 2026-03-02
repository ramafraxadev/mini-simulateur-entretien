import { NextRequest, NextResponse } from 'next/server'

// persona du recruteur — gardé court pour ne pas bouffer les tokens
const SYSTEM_PROMPT = `Tu es Alexandre, recruteur technique chez ProcessIQ, une startup EdTech qui fait des micro-SaaS pour l'éducation.

Tu mènes un entretien pour un poste Lead Dev IA / freelance. Le candidat doit montrer qu'il maîtrise le no-code, JS, les APIs IA et qu'il a une logique produit solide.

Consignes :
- Une seule question à la fois, concrète.
- Réponses courtes, 2-3 phrases max — c'est un entretien oral.
- Si la réponse est vague, creuse. Si elle est bonne, valide et passe à la suite.
- Commence par te présenter rapidement puis pose une première question simple.
- Sujets à couvrir dans l'ordre : no-code, JS/APIs, intégrations IA, vision produit/MVP, EdTech.
- Ton pro mais pas froid. Tu cherches quelqu'un d'autonome.
- Termine toujours tes phrases. Ne coupe pas au milieu d'un mot.`

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY manquant' }, { status: 500 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
            stream: true,
            temperature: 0.7,
            max_tokens: 500,
          }),
        })

        if (!res.ok) {
          const err = await res.text()
          throw new Error(`Groq ${res.status}: ${err}`)
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder('utf-8')
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''

          for (const line of lines) {
            const t = line.trim()
            if (!t.startsWith('data: ')) continue

            const data = t.slice(6).trim()
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
              // chunk json partiel, on skip
            }
          }
        }

        // flush le buffer restant si necessaire
        if (buf.trim().startsWith('data: ')) {
          const data = buf.trim().slice(6).trim()
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data)
              const token = parsed.choices?.[0]?.delta?.content ?? ''
              if (token) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
            } catch { /* ignore */ }
          }
        }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erreur inconnue'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
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