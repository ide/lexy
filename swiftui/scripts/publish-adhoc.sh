#!/bin/zsh
# Builds an ad hoc .ipa and publishes it at https://lexy-exact.tuft.host/swiftui.html.
#
# It signs with the Exact app's ad hoc profile, which covers only `app.ide.lexy`,
# so the build uses that bundle ID and replaces Lexy on the phone.
#
#   LEXY_SIGNING_DIR  holds adhoc.mobileprovision, lexy-sign.keychain-db and kc.pass
#                     (default ~/.config/tuft/secrets/lexy-adhoc)
#   LEXY_OTA_DIR      the install site's web root (default ~/lexy-ota/www)
#   LEXY_OTA_URL      the install site's URL (default https://lexy-exact.tuft.host)
#   LEXY_VERSION      the version (default 1.0.2); iOS won't install a version below the installed one
set -euo pipefail

signing=${LEXY_SIGNING_DIR:-$HOME/.config/tuft/secrets/lexy-adhoc}
www=${LEXY_OTA_DIR:-$HOME/lexy-ota/www}
url=${LEXY_OTA_URL:-https://lexy-exact.tuft.host}
version=${LEXY_VERSION:-1.0.2}
build=$(date +%Y%m%d%H%M)
bundle_id=app.ide.lexy
team=8V678ZKJUQ
here=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

for f in adhoc.mobileprovision lexy-sign.keychain-db kc.pass; do
  [[ -f $signing/$f ]] || { echo "Missing $signing/$f: the Exact build's ad hoc credentials. Set LEXY_SIGNING_DIR to where they are." >&2; exit 1; }
done

keychain=$signing/lexy-sign.keychain-db
security unlock-keychain -p "$(cat "$signing/kc.pass")" "$keychain"
security list-keychains -d user -s $(security list-keychains -d user | tr -d '"' | grep -v lexy-sign) "$keychain"
identity=$(security find-identity -v -p codesigning "$keychain" | awk '/Apple Distribution/ {print $2; exit}')
security cms -D -i "$signing/adhoc.mobileprovision" > "$work/profile.plist"
profile=$(plutil -extract UUID raw "$work/profile.plist")
[[ $(plutil -extract Entitlements.application-identifier raw "$work/profile.plist") == "$team.$bundle_id" ]] || {
  echo "The profile in $signing isn't for $team.$bundle_id, so the build couldn't be signed with it." >&2; exit 1; }
profiles="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
mkdir -p "$profiles"
cp "$signing/adhoc.mobileprovision" "$profiles/$profile.mobileprovision"

cd "$here"
xcodegen generate --quiet
xcodebuild archive -project Lexy.xcodeproj -scheme Lexy -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$work/Lexy.xcarchive" -derivedDataPath build/dd-device -quiet \
  PRODUCT_BUNDLE_IDENTIFIER=$bundle_id DEVELOPMENT_TEAM=$team CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="$identity" PROVISIONING_PROFILE_SPECIFIER="$profile" \
  MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$build"

cat > "$work/export.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>release-testing</string>
<key>teamID</key><string>$team</string>
<key>signingStyle</key><string>manual</string>
<key>signingCertificate</key><string>$identity</string>
<key>provisioningProfiles</key><dict><key>$bundle_id</key><string>$profile</string></dict>
<key>thinning</key><string>&lt;none&gt;</string>
</dict></plist>
EOF
xcodebuild -exportArchive -archivePath "$work/Lexy.xcarchive" -exportPath "$work/export" -exportOptionsPlist "$work/export.plist" -quiet

unzip -q "$work/export/Lexy.ipa" -d "$work/check"
app=$(ls -d "$work"/check/Payload/*.app)
codesign --verify --deep --strict "$app"
echo "$(plutil -extract CFBundleIdentifier raw "$app/Info.plist") $(plutil -extract CFBundleShortVersionString raw "$app/Info.plist") ($(plutil -extract CFBundleVersion raw "$app/Info.plist"))"

cp "$work/export/Lexy.ipa" "$www/LexySwiftUI-$build.ipa"
cat > "$www/manifest-s.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>items</key><array><dict>
<key>assets</key><array>
<dict><key>kind</key><string>software-package</string><key>url</key><string>$url/LexySwiftUI-$build.ipa</string></dict>
<dict><key>kind</key><string>display-image</string><key>url</key><string>$url/icon57.png</string></dict>
<dict><key>kind</key><string>full-size-image</string><key>url</key><string>$url/icon512.png</string></dict>
</array>
<key>metadata</key><dict>
<key>bundle-identifier</key><string>$bundle_id</string>
<key>bundle-version</key><string>$version</string>
<key>kind</key><string>software</string>
<key>title</key><string>Lexy (SwiftUI)</string>
</dict></dict></array></dict></plist>
EOF
cat > "$www/swiftui.html" <<EOF
<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lexy (SwiftUI)</title>
<body style="font:17px -apple-system;text-align:center;padding:48px 24px">
<img src="icon512.png" width="96" style="border-radius:22px"><h2>Lexy, built with SwiftUI</h2>
<p>Ad hoc build $version ($build) · replaces the installed Lexy ($bundle_id)</p>
<p><a style="display:inline-block;background:#007aff;color:#fff;padding:14px 28px;border-radius:24px;text-decoration:none;font-weight:600" href="itms-services://?action=download-manifest&amp;url=$url/manifest-s.plist">Install</a></p>
</body>
EOF
ls -t "$www"/LexySwiftUI-*.ipa | tail -n +4 | xargs rm -f
echo "Published Lexy (SwiftUI) $version ($build): $url/swiftui.html"
