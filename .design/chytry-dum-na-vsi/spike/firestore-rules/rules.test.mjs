/**
 * Firestore Rules emulator tests.
 * Before running:
 *   1. `npm install`
 *   2. `npx firebase emulators:start --only firestore,auth`  (separate terminal)
 *   3. `npm test`
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = "clever-house-spike";

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();

  // Seed user docs using admin (bypass rules).
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", "stanislav"), {
      email: "stanislav@example.com",
      role: "OWNER",
    });
    await setDoc(doc(db, "users", "projektant"), {
      email: "projektant@example.com",
      role: "PROJECT_MANAGER",
    });
    // Seed one task (otazka) and one nápad
    await setDoc(doc(db, "tasks", "t-otazka"), {
      type: "otazka",
      title: "Kabely pro LED",
      body: "Připravit rozvody ve stěně pracovny.",
      status: "Čekám",
      createdBy: "stanislav",
    });
    await setDoc(doc(db, "tasks", "t-napad"), {
      type: "napad",
      title: "Zahradní zásuvka",
      body: "Nápad z IG.",
      status: "Nápad",
      createdBy: "stanislav",
    });
  });
});

function asStanislav() {
  return env.authenticatedContext("stanislav").firestore();
}
function asProjektant() {
  return env.authenticatedContext("projektant").firestore();
}
function asAnon() {
  return env.unauthenticatedContext().firestore();
}

describe("OWNER (Stanislav)", () => {
  it("can read otázku", async () => {
    await assertSucceeds(getDoc(doc(asStanislav(), "tasks", "t-otazka")));
  });
  it("can read nápad", async () => {
    await assertSucceeds(getDoc(doc(asStanislav(), "tasks", "t-napad")));
  });
  it("can create nový nápad", async () => {
    await assertSucceeds(
      addDoc(collection(asStanislav(), "tasks"), {
        type: "napad",
        title: "New",
        status: "Nápad",
        createdBy: "stanislav",
      })
    );
  });
  it("can delete task", async () => {
    await assertSucceeds(deleteDoc(doc(asStanislav(), "tasks", "t-napad")));
  });
});

describe("PROJECT_MANAGER (Projektant)", () => {
  it("can read otázku", async () => {
    await assertSucceeds(getDoc(doc(asProjektant(), "tasks", "t-otazka")));
  });

  it("CANNOT read nápad", async () => {
    await assertFails(getDoc(doc(asProjektant(), "tasks", "t-napad")));
  });

  it("CANNOT create task", async () => {
    await assertFails(
      addDoc(collection(asProjektant(), "tasks"), {
        type: "napad",
        title: "X",
        status: "Nápad",
        createdBy: "projektant",
      })
    );
  });

  it("can update projektantAnswer + status on otázka", async () => {
    await assertSucceeds(
      updateDoc(doc(asProjektant(), "tasks", "t-otazka"), {
        projektantAnswer: "Ano, doporučuji 3x230V okruh.",
        status: "Rozhodnuto",
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("CANNOT update title or body on otázka", async () => {
    await assertFails(
      updateDoc(doc(asProjektant(), "tasks", "t-otazka"), {
        title: "Hacked title",
      })
    );
  });

  it("CANNOT delete task", async () => {
    await assertFails(deleteDoc(doc(asProjektant(), "tasks", "t-otazka")));
  });
});

describe("Anonymous", () => {
  it("CANNOT read any task", async () => {
    await assertFails(getDoc(doc(asAnon(), "tasks", "t-otazka")));
  });
  it("CANNOT write any task", async () => {
    await assertFails(
      addDoc(collection(asAnon(), "tasks"), { type: "napad" })
    );
  });
});
