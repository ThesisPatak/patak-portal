# ✅ GitHub Actions Setup - Final Step

Your code is now pushed to GitHub! 

## Next Step: Add EXPO_TOKEN Secret

You need to generate an Expo token and add it to GitHub secrets for the build to work.

### Option 1: Using Expo Website (Recommended)

1. Go to https://expo.dev/settings/tokens
2. Click "Create token"
3. Give it a name like "GitHub Actions"
4. Copy the token value

### Option 2: Using EAS CLI

```bash
eas token create
```

### Add Secret to GitHub

1. Go to: https://github.com/ThesisPatak/patak-portal/settings/secrets/actions
2. Click "New repository secret"
3. **Name:** `EXPO_TOKEN`
4. **Value:** Paste your token from step above
5. Click "Add secret"

### Trigger the Build

After adding the secret:

1. Go to: https://github.com/ThesisPatak/patak-portal/actions
2. Click "Build Android APK" workflow
3. Click "Run workflow" button
4. Select branch "main"
5. Click "Run workflow"

The build will start and you'll see progress in real-time!

### Download APK

Once the workflow completes (10-30 minutes):
1. Click the completed workflow run
2. Scroll to "Artifacts" section
3. Download "android-apk"

Your APK will be inside!

---

**Current Status:**
✅ Code pushed to GitHub
✅ GitHub Actions workflow ready
⏳ Waiting for EXPO_TOKEN secret
⏳ Waiting to trigger build
