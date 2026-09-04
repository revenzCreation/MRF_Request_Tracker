# Google Sheets and Drive setup

## 1. Create the database

1. Open your existing Google Sheet. The existing `Referrals` tab and data will remain unchanged.
2. Open **Extensions > Apps Script** in that spreadsheet.
3. Replace the starter script with the contents of `Code.gs`.
4. Confirm `sheetName: 'MRF Requests'` in `Code.gs`.
5. Optionally set `driveFolderId` to an existing Drive folder ID. Leave it blank to let the script create or reuse `MRF Monitor Uploads`.
6. Run `getSheet` once from the Apps Script editor and approve the Google Sheets and Drive permissions.

The script creates an `MRF Requests` sheet with headers automatically. Each upload is stored in Drive and its `fileUrl` is saved in the matching row. The existing referral website continues using the `Referrals` tab.

## 2. Deploy the API

1. In Apps Script, choose **Deploy > New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to the users who need to submit requests, or **Anyone** for a public internal tool.
5. Deploy and copy the Web app URL ending in `/exec`.

## 3. Connect the website

Open `js/config.js` and set:

```js
export const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

Serve the website from a web server rather than opening `index.html` directly. For example, any static hosting service works. The page will then load rows from Sheets, upload files to Drive, and show the Drive link in the request detail view.

## Notes

- The frontend limits uploads to 5 MB.
- Updating a request changes its Sheet row. It does not upload another file unless a new file is submitted.
- Deleting a request removes the Sheet row. It does not delete the Drive file, preserving the stored attachment.
- If the deployment is restricted, every user must be authorized to access the Apps Script web app. Both websites can use the same deployed `/exec` URL: referral payloads without an `action` use `Referrals`, while this MRF site uses `save` and `delete` actions on `MRF Requests`.
