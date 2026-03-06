export function buildMaterialAnalysisPrompt(text) {
  return `
Du analyserar interna onboarding-dokument för socialt arbete.

Extrahera strukturerad kunskap ur texten.

Identifiera:

1. Arbetsprocesser
2. Lagrum eller regler
3. Ansvar eller roller
4. Riskmoment

Returnera endast JSON i detta format:

{
  "processes": [
    {
      "name": "",
      "steps": [],
      "sourceSnippets": []
    }
  ],
  "legalReferences": [
    {
      "ref": "",
      "context": "",
      "sourceSnippets": []
    }
  ],
  "responsibilities": [
    {
      "roleOrFunction": "",
      "responsibility": "",
      "sourceSnippets": []
    }
  ],
  "risks": [
    {
      "risk": "",
      "mitigation": "",
      "sourceSnippets": []
    }
  ]
}

Regler:
- Svara endast med JSON
- Inga kommentarer
- Inga extra fält
- Om något saknas returnera tom array

TEXT:
${text}
`;
}