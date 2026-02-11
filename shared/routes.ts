import { z } from 'zod';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  greeting: {
    get: {
      method: 'GET' as const,
      path: '/api/greeting' as const,
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
  },
  scenarios: {
    list: {
      method: 'GET' as const,
      path: '/api/scenarios' as const,
    },
    get: {
      method: 'GET' as const,
      path: '/api/scenarios/:id' as const,
    },
    getBySlug: {
      method: 'GET' as const,
      path: '/api/scenarios/slug/:slug' as const,
    },
  },
  personas: {
    list: {
      method: 'GET' as const,
      path: '/api/personas' as const,
    },
    get: {
      method: 'GET' as const,
      path: '/api/personas/:id' as const,
    },
    getByScenario: {
      method: 'GET' as const,
      path: '/api/scenarios/:scenarioId/personas' as const,
    },
  },
  templates: {
    list: {
      method: 'GET' as const,
      path: '/api/templates' as const,
    },
    create: {
      method: 'POST' as const,
      path: '/api/templates' as const,
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/templates/:id' as const,
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/templates/:id' as const,
    },
  },
  sessions: {
    list: {
      method: 'GET' as const,
      path: '/api/sessions' as const,
    },
    get: {
      method: 'GET' as const,
      path: '/api/sessions/:id' as const,
    },
    create: {
      method: 'POST' as const,
      path: '/api/sessions' as const,
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/sessions/:id' as const,
    },
    advance: {
      method: 'POST' as const,
      path: '/api/sessions/:sessionId/advance' as const,
    },
  },
  messages: {
    list: {
      method: 'GET' as const,
      path: '/api/sessions/:sessionId/messages' as const,
    },
    create: {
      method: 'POST' as const,
      path: '/api/sessions/:sessionId/messages' as const,
    },
  },
  artifacts: {
    list: {
      method: 'GET' as const,
      path: '/api/sessions/:sessionId/artifacts' as const,
    },
    create: {
      method: 'POST' as const,
      path: '/api/sessions/:sessionId/artifacts' as const,
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/artifacts/:id' as const,
    },
  },
  assessments: {
    get: {
      method: 'GET' as const,
      path: '/api/sessions/:sessionId/assessment' as const,
    },
    create: {
      method: 'POST' as const,
      path: '/api/sessions/:sessionId/assessment' as const,
    },
    updateHitl: {
      method: 'PATCH' as const,
      path: '/api/assessments/:id/hitl' as const,
    },
  },
  userConfig: {
    get: {
      method: 'GET' as const,
      path: '/api/user-config' as const,
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/user-config' as const,
    },
  },
  seed: {
    run: {
      method: 'POST' as const,
      path: '/api/seed' as const,
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
