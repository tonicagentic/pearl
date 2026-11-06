import { isBuiltinSkillSlug } from "@/lib/skills/builtins";
import {
  validateSkillSlugShape,
  type SkillValidationError,
} from "@/lib/skills/validation";

/** Full slug check including built-in name collisions. Server-only. */
export function validateSkillSlug(
  slug: string,
): SkillValidationError | null {
  const shape = validateSkillSlugShape(slug);
  if (shape) {
    return shape;
  }
  const trimmed = slug.trim();
  if (isBuiltinSkillSlug(trimmed)) {
    return {
      field: "slug",
      message: `"${trimmed}" is a built-in skill and cannot be overridden.`,
    };
  }
  return null;
}
