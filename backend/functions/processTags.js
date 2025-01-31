const { dbTagColors } = require('./database.js');
const generateHexColor = require('./generateHexColor.js');

function processTags (req, tags) {
    const tagsExtended = tags ? [req.user.username, ...tags] : [req.user.username]; // Add the user's username as a tag (at least username)
    const tagsJson = JSON.stringify(tagsExtended); // Convert tags array to JSON string
    // Process each tag in tagsExtended
    tagsExtended.forEach(tag => {
      dbTagColors.get(`SELECT * FROM tagColors WHERE tag = ?`, [tag], (err, row) => {
          if (err) {
              console.error(`Error checking tag: ${tag}`, err.message);
              return;
          }
  
          // If the tag does not exist, insert it with a new color
          if (!row) {
            dbTagColors.run(`INSERT INTO tagColors (tag, color) VALUES (?, ?)`, [tag, generateHexColor()], (err) => {
                  if (err) {
                      console.error(`Error inserting tag: ${tag}`, err.message);
                  } else {
                      // console.log(`Tag '${tag}' added with color assigned.`);
                  }
              });
          }
      });
    });
    return tagsJson;
}

module.exports = {
    processTags
};