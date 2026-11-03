import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: file('src/content/projects.json'),
  schema: z.object({
    title: z.string(),
    client: z.string(),
    year: z.number().int(),
    summary: z.string(),
    stack: z.array(z.string()).min(1),
    order: z.number().int(),
  }),
});

const testimonials = defineCollection({
  loader: file('src/content/testimonials.json'),
  schema: z.object({
    quote: z.string(),
    author: z.string(),
    role: z.string(),
  }),
});

const experience = defineCollection({
  loader: file('src/content/experience.json'),
  schema: z.object({
    period: z.string(),
    company: z.string(),
    role: z.string(),
    order: z.number().int(),
  }),
});

const team = defineCollection({
  loader: file('src/content/team.json'),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    bio: z.string(),
    star: z.enum(['blue', 'violet']),
    order: z.number().int(),
  }),
});

export const collections = { projects, testimonials, experience, team };
