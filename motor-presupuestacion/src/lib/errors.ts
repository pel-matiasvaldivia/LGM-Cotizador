// Error con status HTTP, que withErrorHandling() traduce a la respuesta. Vive
// acá (y no en auth.ts) para que lo puedan lanzar módulos de los que auth.ts
// depende, sin ciclos de importación.
export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
