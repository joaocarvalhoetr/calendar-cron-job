// Declarações de módulo para resolver imports .js que apontam para arquivos .tsx/.ts
// Isso resolve o problema do Next.js gerar imports com .js em arquivos gerados
declare module "../../app/page.js" {
  export * from "../../app/page";
  export { default } from "../../app/page";
}

declare module "../../app/layout.js" {
  export * from "../../app/layout";
  export { default } from "../../app/layout";
}

