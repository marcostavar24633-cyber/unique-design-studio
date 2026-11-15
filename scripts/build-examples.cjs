// Пересобирает examples/: 10 проектов подряд, каждый сверяется с предыдущим.
const fs = require("fs");
const path = require("path");
const E = require("../engine/design-engine.js");

const inputs = [
  ["Слопай букет", "съедобные букеты из ягод и мяса", "Ульяновск"],
  ["ПЕНКА", "кофейня на углу"],
  ["Photograf", "свадебный фотограф"],
  ["ДомА Тех", "интернет-магазин бытовой техники"],
  ["РАКОВАРНЯ 73", "раки с доставкой", "Ульяновск"],
  ["Hair", "парикмахерская"],
  ["Ровно", "ремонт и отделка квартир", "Ульяновск"],
  ["Звёздный", "магазин телескопов"],
  ["Право+", "налоговый юрист"],
  ["Шум", "фестиваль экспериментальной музыки"]
];

const dir = path.join(__dirname, "..", "examples");
fs.mkdirSync(dir, { recursive: true });
const history = [];
inputs.forEach(([brand, description, city], i) => {
  const c = E.createConcept({ brand, description, city }, history);
  history.push(c);
  const name = `${String(i + 1).padStart(2, "0")}-${c.designDNA.primaryArchetype}.html`;
  fs.writeFileSync(path.join(dir, name), E.renderHomepage(c));
  console.log(`${brand.padEnd(14)} ${c.designDNA.primaryArchetypeName.padEnd(26)} ${c.designDNA.fonts.display}`);
});
