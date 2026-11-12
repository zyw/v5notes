# v5notes2 GitHub Image Publishing CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions workflow that packages the v5notes2 API and publishes its Docker image to OneDev.

**Architecture:** Run the workflow on GitHub-hosted Ubuntu. Build the JAR with the repository Maven Wrapper, then use Docker Buildx with the v5notes2 directory as context and authenticate to OneDev using GitHub Actions secrets.

**Tech Stack:** GitHub Actions, Java 21, Maven Wrapper, Docker Buildx, OneDev Container Registry.

**Spec:** `docs/onedev-container-registry.md`, section “用 GitHub Actions 构建并推送 API”.

## Global Constraints

- Push trigger: tags matching `api-v5notes2-*`; manual trigger publishes only from `main`.
- Only publish from canonical repository `zyw/v5notes`.
- Image: `onedev.v5ai.xin/docker-imgs/v5notes2-api`.
- OneDev username is a GitHub Actions variable; the Package Writer token is a GitHub Actions secret.
- Workflow token permissions are limited to `contents: read`.
- API build requires Java 21 and produces `v5notes2/note-admin/target/v5notes2.jar`.
- Do not publish from pull request workflows.

## Review Focus

- Confirm the JAR is built before the image step and included by the path build context.
- Confirm only API release tags and `main` manual runs can reach the OneDev login/push steps.
- Confirm release tags normalize to a valid image version and also publish a full-SHA tag.
- Confirm the OneDev image path targets the `docker-imgs` package project.
- Confirm a runner network failure is reported as an external connectivity prerequisite, not a build failure in the repository.

---

### Task 1: Add the API image publishing workflow

**Files:**
- Create: `.github/workflows/publish-api-image.yml`

**Interfaces:**
- Consumes: `docs/onedev-container-registry.md` workflow example and OneDev Actions variable/secret names.
- Produces: an API image tagged with the normalized release version and `sha-<commit>`.

- [x] Add the workflow with the tag and manual triggers, canonical-repository guard, Maven package step, OneDev login, and Buildx push configuration from the spec.
- [x] Parse the workflow YAML and confirm the referenced Dockerfile and artifact paths.
- [x] Review the final workflow file and verify no literal secret or token values were added to the repository.
