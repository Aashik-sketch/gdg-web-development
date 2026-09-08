# GDG Web Development — Work Log

## Department cleanup

Updated the department display layer to replace scrambled placeholder names with production-friendly department names while preserving the existing stable UUID identifiers.

### Departments

1. UI/UX
2. Competitive Programming
3. Data Science
4. Web Development
5. App Development
6. Management
7. Design
8. Marketing & Outreach
9. Content & Documentation
10. Cybersecurity
11. Cloud & DevOps
12. Events & Community

### Technical note

Department UUIDs remain unchanged so existing routing and internal references continue to work. Display names and descriptions are maintained through `constants/departmentNames.js`.

### Commit

Department names and descriptions were updated in the `main` branch.

### Next check

Verify the departments page and deployed Vercel build after deployment completes. Also review the questionnaire copy before production because the repository originally contained scrambled questionnaire placeholders.
