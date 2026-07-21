-- 013_editor_system_policies.sql
-- Allow editors to manage the system curator's collections and sources

-- Editors can create collections under the system curator (user_id IS NULL)
CREATE POLICY "Editors can create system collections" ON collections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM curators
      WHERE id = curator_id
        AND user_id IS NULL
    )
    AND
    EXISTS (
      SELECT 1 FROM curators
      WHERE user_id = auth.uid()
        AND role = 'editor'
    )
  );

-- Editors can add sources to system collections
CREATE POLICY "Editors can add sources to system collections" ON sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      JOIN curators cu ON c.curator_id = cu.id
      WHERE c.id = collection_id
        AND cu.user_id IS NULL
    )
    AND
    EXISTS (
      SELECT 1 FROM curators
      WHERE user_id = auth.uid()
        AND role = 'editor'
    )
  );
