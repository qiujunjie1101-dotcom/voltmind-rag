// Deployment builds deliberately expose reading only. Local development keeps editing tools.
export const readOnly = import.meta.env.PROD || import.meta.env.VITE_WORKSPACE_READ_ONLY === 'true'
