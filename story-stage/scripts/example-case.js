import { mkdir, writeFile } from 'node:fs/promises';
import { runCaseExample } from '../examples/case-fixture.js';
import { exportStory } from '../src/engine.js';
const project = runCaseExample();
await mkdir('examples/output', { recursive: true });
await writeFile('examples/output/case-story.md', `> ${project.fixture_notice}\n\n${exportStory(project)}`);
await writeFile('examples/output/case-log.json', JSON.stringify(project, null, 2));
console.log(`Đã kiểm tra ${project.scenes.length} cảnh, ${project.reader.clues.length} manh mối, ${project.reader.answers.length} đáp án. Artifact: examples/output/. Dữ liệu minh họa viết sẵn, không gọi ChatGPT.`);
