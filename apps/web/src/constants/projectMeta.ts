/**
 * @fileoverview Public project links and contributor list for marketing / login footer.
 * Keep in sync with `AUTHORS.md` at the repo root. Add `githubUsername` when known for GitHub avatars.
 */

/** Official upstream repository (branch master). */
export const FORGE_GITHUB_URL = "https://github.com/kreodevs/theforge/tree/master";

/** Apache License, Version 2.0 — canonical text on apache.org */
export const APACHE_LICENSE_URL = "https://www.apache.org/licenses/LICENSE-2.0";

export interface ProjectContributor {
  id: string;
  name: string;
  role: string;
  /** Full image URL; overrides GitHub avatar when set */
  avatarUrl?: string;
  /** GitHub login — avatar loaded via public GitHub API (`avatar_url`) */
  githubUsername?: string;
  profileUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
}

/**
 * Faces shown in the login footer stack (see AUTHORS.md).
 * Primary click uses `profileUrl`, then GitHub / LinkedIn. Use `mailto:` when no public profile is known.
 *
 * Avatars: set `githubUsername` for the official GitHub profile photo (loaded via public GitHub API).
 * Without it, the UI tries Gravatar using the email from `mailto:` (same email as GitHub → often matches).
 */
export const PROJECT_CONTRIBUTORS: ProjectContributor[] = [
  {
    id: "jorge-correa",
    name: "Jorge Correa",
    role: "Autor principal",
    githubUsername: "kreodevs",
    profileUrl: "mailto:jcorrea@e-personal.net",
    githubUrl: "https://github.com/kreodevs",
  },
  {
    id: "maria-gregoria-ayala-calderon",
    name: "Maria Gregoria Ayala Calderon",
    role: "Colaborador especial",
    githubUsername: "MariaGregoria",
    profileUrl: "mailto:marigregoria18@gmail.com",
    githubUrl: "https://github.com/MariaGregoria",
  },
  {
    id: "gerardo-olaf-ruvalcaba-aguirre",
    name: "Gerardo Olaf Ruvalcaba Aguirre",
    role: "Colaborador especial",
    githubUsername: "OlafRuv",
    profileUrl: "mailto:olaf.ruvag@gmail.com",
    githubUrl: "https://github.com/OlafRuv",
  },
  {
    id: "ricardo-mundo",
    name: "Ricardo Mundo",
    role: "Colaborador especial",
    githubUsername: "rikimundo-dev",
    profileUrl: "mailto:Ricardomundovelazquez@gmail.com",
    githubUrl: "https://github.com/rikimundo-dev",
  },
  {
    id: "luis-octavio-lara",
    name: "Luis Octavio Lara",
    role: "Colaborador especial",
    githubUsername: "luislara-dev",
    profileUrl: "mailto:luis.lara.lic.dis@gmail.com",
    githubUrl: "https://github.com/luislara-dev",
  },
  {
    id: "oscar-rubio-sevilla",
    name: "Oscar Rubio Sevilla",
    role: "Colaborador especial",
    githubUsername: "OscarRubioSevilla",
    profileUrl: "mailto:rubio.sevilla.oscar@gmail.com",
    githubUrl: "https://github.com/OscarRubioSevilla",
  },
  {
    id: "zeferino-martinez-garcia",
    name: "Zeferino Martínez García",
    role: "Colaborador especial",
    githubUsername: "zefedev",
    profileUrl: "mailto:zmartinezga@outlook.com",
    githubUrl: "https://github.com/zefedev",
  },
  {
    id: "andre-martin-garcia-lopez",
    name: "André Martin García López",
    role: "Colaborador especial",
    githubUsername: "andremartingarcialopez",
    profileUrl: "mailto:andy_garlop4@hotmail.com",
    githubUrl: "https://github.com/andremartingarcialopez",
  },
  {
    id: "rene-dario-carrillo-urquieta",
    name: "René Darío Carrillo Urquieta",
    role: "Colaborador especial",
    githubUsername: "rexdariodeveloper",
    profileUrl: "mailto:rex.dario.developer@gmail.com",
    githubUrl: "https://github.com/rexdariodeveloper",
  },
  {
    id: "israel-alejandro-loera-perez",
    name: "Israel Alejandro Loera Pérez",
    role: "Colaborador especial",
    githubUsername: "IsraelAlejandro23",
    profileUrl: "mailto:israel_alejandro1993@hotmail.com",
    githubUrl: "https://github.com/IsraelAlejandro23",
  },
];
