import { createDesignConcept } from "./design-director.js";
import { createVisualIdentity } from "./visual-identity.js";
import { createLayoutPlan, renderLayoutCss } from "./layout-engine.js";
import { renderHtmlPage, renderComponentCss } from "./component-renderer.js";

/**
 * Execute the local brief → concept → visual identity → layout → HTML pipeline.
 * The concept and identity engines are deterministic heuristics, not generative AI.
 */
export function createStudioProject(input = {}) {
  const businessType = String(input.businessType ?? "").trim();
  if (!businessType) throw new TypeError("businessType is required");

  const concept = createDesignConcept({
    businessType,
    businessName:input.businessName,
    audience:input.audience,
    primaryGoal:input.primaryGoal ?? "lead",
    brandCharacter:input.brandCharacter,
    contentPriority:input.contentPriority,
    history:input.history
  });

  const visualIdentity = createVisualIdentity({
    concept,
    identitySeed:input.identitySeed,
    paletteId:input.paletteId,
    shapeId:input.shapeId,
    overrides:input.overrides
  });

  const contentBySection = input.contentBySection && typeof input.contentBySection === "object"
    ? input.contentBySection : {};
  const sectionOrder = Array.isArray(input.sectionOrder) ? input.sectionOrder : concept.homepage.sectionOrder;
  const sections = sectionOrder.map(id => ({
    id,
    title:contentBySection[id]?.title ?? null,
    content:contentBySection[id] ?? null
  }));
  const layoutPlan = createLayoutPlan({ concept, visualIdentity, sections });
  const css = [renderLayoutCss(layoutPlan), renderComponentCss(visualIdentity)].join("\n");
  const html = renderHtmlPage({
    layoutPlan,
    visualIdentity,
    title:input.pageTitle || input.businessName || businessType,
    description:input.description || `Официальный сайт: ${input.businessName || businessType}`,
    businessName:input.businessName || businessType,
    brandName:input.brandName || input.businessName || businessType,
    navigation:input.navigation || [],
    contacts:input.contacts || {},
    socialLinks:input.socialLinks || [],
    footerText:input.footerText,
    css,
    lang:input.lang || "ru"
  });

  return {
    schemaVersion:"1.0.0",
    concept,
    visualIdentity,
    layoutPlan,
    sectionOrder:[...sectionOrder],
    css,
    html,
    metadata:{
      projectName:input.businessName || businessType,
      generatedLocally:true,
      externalApiUsed:false,
      requiresContentReview:true,
      requiresFormIntegration:true
    }
  };
}
