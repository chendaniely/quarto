/*
 * preview-util.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import semver from "semver";

import vscode from "vscode";
import { TextDocument, TextEditor, Uri, workspace } from "vscode";
import { parseFrontMatterStr, projectDirForDocument } from "quarto-core";

import { MarkdownEngine } from "../../markdown/engine";
import {
  metadataFilesForDocument,
  yamlFromMetadataFile,
} from "quarto-core";
import { isNotebook } from "../../core/doc";

export function previewDirForDocument(uri: Uri) {
  // first check for a quarto project
  const projectDir = projectDirForDocument(uri.fsPath);
  if (projectDir) {
    return projectDir;
  } else {
    // now check if we are within a workspace root
    const workspaceDir = workspace.getWorkspaceFolder(uri);
    if (workspaceDir) {
      return workspaceDir.uri.fsPath;
    }
  }
  return undefined;
}

export async function isQuartoShinyDoc(
  engine: MarkdownEngine,
  doc?: TextDocument
) {
  if (doc) {
    const frontMatter = await documentFrontMatter(engine, doc);
    if (frontMatter["server"] === "shiny") {
      return true;
    } else {
      if (typeof frontMatter["server"] === "object") {
        return (
          (frontMatter["server"] as Record<string, unknown>)["type"] === "shiny"
        );
      }
    }
    return false;
  } else {
    return false;
  }
}

export async function documentFrontMatter(
  engine: MarkdownEngine,
  doc: TextDocument
): Promise<Record<string, unknown>> {
  const tokens = await engine.parse(doc);
  const yaml = tokens.find((token) => token.type === "front_matter");
  if (yaml) {
    const frontMatter = parseFrontMatterStr(yaml.markup);
    if (typeof frontMatter === "object") {
      return frontMatter as Record<string, unknown>;
    } else {
      return {};
    }
  } else {
    return {};
  }
}

export async function renderOnSave(engine: MarkdownEngine, editor: TextEditor) {
  // if its a notebook and we don't have a save hook for notebooks then don't
  // allow renderOnSave (b/c we can't detect the saves)
  if (isNotebook(editor.document) && !haveNotebookSaveEvents()) {
    return false;
  }

  // notebooks automatically get renderOnSave
  if (isNotebook(editor.document)) {
    return true;
  }

  // first look for document level editor setting
  const docYaml = await documentFrontMatter(engine, editor.document);
  const docSetting = readRenderOnSave(docYaml);
  if (docSetting !== undefined) {
    return docSetting;
  }

  // now project level (take the first metadata file with a setting)
  const projectDir = projectDirForDocument(editor.document.uri.fsPath);
  if (projectDir) {
    const metadataFiles = metadataFilesForDocument(editor.document.uri.fsPath);
    if (metadataFiles) {
      for (const metadataFile of metadataFiles) {
        const yaml = yamlFromMetadataFile(metadataFile);
        const projSetting = readRenderOnSave(yaml);
        if (projSetting !== undefined) {
          return projSetting;
        }
      }
    }
  }

  // finally, consult vs code settings
  const render =
    workspace.getConfiguration("quarto").get<boolean>("render.renderOnSave") ||
    false;
  return render;
}

export function haveNotebookSaveEvents() {
  return (
    semver.gte(vscode.version, "1.67.0") &&
    !!(workspace as any).onDidSaveNotebookDocument
  );
}

function readRenderOnSave(yaml: Record<string, unknown>) {
  if (typeof yaml["editor"] === "object") {
    const yamlObj = yaml["editor"] as Record<string, unknown>;
    if (typeof yamlObj["render-on-save"] === "boolean") {
      return yamlObj["render-on-save"] as boolean;
    }
  }
  return undefined;
}
