/**
 * Template Merge Service
 * Handles merging template placeholders with project data
 */

/**
 * Render a table section's rows to HTML
 * @param {Array} rows - Array of row objects
 * @param {string} sectionId - Section ID for data attribute
 * @returns {string} HTML string
 */
function renderTableFromRows(rows, sectionId) {
  let html = `<table class="trp-appraisal-table" data-section-id="${sectionId}"><tbody>`;
  for (const row of rows) {
    if (row.type === 'header') {
      html += `<tr class="tbl-header"><td colspan="2"><strong>${row.content}</strong></td></tr>`;
    } else {
      const content = row.content || '';
      html += `<tr class="tbl-row"><td class="tbl-label"><strong>${row.label}</strong></td><td class="tbl-value">${content}</td></tr>`;
    }
  }
  html += '</tbody></table>';
  return html;
}

/**
 * Extract all placeholders from a template
 * Supports both {{placeholder}} and «placeholder» formats
 * @param {Object} template - Template object with sections
 * @returns {Set<string>} Set of unique placeholder names
 */
export function extractPlaceholders(template) {
  const placeholders = new Set();
  const curlyRegex = /\{\{([^}]+)\}\}/g;
  const guillemetRegex = /«([^»]+)»/g;

  if (!template?.sections) return placeholders;

  function extractFromText(text) {
    if (!text) return;
    const curlyMatches = text.matchAll(curlyRegex);
    for (const match of curlyMatches) placeholders.add(match[1].trim());
    const guilleMatches = text.matchAll(guillemetRegex);
    for (const match of guilleMatches) placeholders.add(match[1].trim());
  }

  template.sections.forEach(section => {
    if (section.type === 'table' && section.rows) {
      section.rows.forEach(row => extractFromText(row.content));
    } else {
      extractFromText(section.content);
      if (section.items && Array.isArray(section.items)) {
        section.items.forEach(item => extractFromText(item));
      }
    }
  });

  return placeholders;
}

/**
 * Build placeholder map from project data
 * @param {Object} projectData - Project data from database
 * @returns {Object} Map of placeholder names to values
 */
export function buildPlaceholderMap(projectData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Extract LPA - handle JSONB array
  let lpaValue = 'N/A';
  if (projectData.local_planning_authority) {
    if (typeof projectData.local_planning_authority === 'string') {
      try {
        const parsed = JSON.parse(projectData.local_planning_authority);
        lpaValue = Array.isArray(parsed) ? parsed.join(', ') : parsed;
      } catch {
        lpaValue = projectData.local_planning_authority;
      }
    } else if (Array.isArray(projectData.local_planning_authority)) {
      lpaValue = projectData.local_planning_authority.join(', ');
    }
  }

  // Extract project name without location suffix (for solar farms)
  let projectNameOnly = projectData.project_name || 'N/A';
  if (projectNameOnly !== 'N/A') {
    projectNameOnly = projectNameOnly
      .replace(/\s+(Solar|solar)\s+(Farm|farm|Park|park|PV|pv)$/i, '')
      .trim();
  }

  const placeholderMap = {
    'project_name': projectData.project_name || 'N/A',
    'project_id': projectData.project_id || 'N/A',
    'current_date': dateStr,
    'client': projectData.client || 'N/A',
    'client_spv_name': projectData.client_spv_name || projectData.client || 'N/A',
    'address': projectData.address || 'N/A',
    'area': projectData.area || 'N/A',
    'local_planning_authority': lpaValue,
    'project_lead': projectData.project_lead || 'N/A',
    'project_manager': projectData.project_manager || 'N/A',
    'project_director': projectData.project_director || 'N/A',
    'sub_sector': Array.isArray(projectData.sub_sectors) && projectData.sub_sectors.length ? projectData.sub_sectors.join(', ') : 'N/A',
    'sector': Array.isArray(projectData.sectors) && projectData.sectors.length ? projectData.sectors.join(', ') : 'N/A',
    'designations_on_site': projectData.designations_on_site || 'None identified',
    'relevant_nearby_designations': projectData.relevant_nearby_designations || 'None identified'
  };

  // Add aliases with different naming conventions (for «guillemet» placeholders)
  placeholderMap['Project_name_name_only__eg_dont_inc'] = projectNameOnly;
  placeholderMap['Site_address_including_postcode'] = placeholderMap['address'];
  placeholderMap['Client_or_SPV_name_'] = placeholderMap['client_spv_name'];
  placeholderMap['Local_planning_authority'] = placeholderMap['local_planning_authority'];
  const firstSubSector = Array.isArray(projectData.sub_sectors) ? projectData.sub_sectors[0] : null;
  placeholderMap['Detailed_Description_of_Development_'] = firstSubSector
    ? `${firstSubSector} development`
    : '[Insert detailed development description]';

  // Technical solar fields - leave as placeholders (will be populated from another source later)
  placeholderMap['GWh_per_year'] = 'xx';
  placeholderMap['Homes_powered_per_year'] = 'xx';
  placeholderMap['Tonnes_of_CO2_offset_per_year_'] = 'xx';
  placeholderMap['Approximate__export_capacity_MW'] = 'xx';
  placeholderMap['Proposed_use_duration_years'] = 'xx';
  placeholderMap['Use_duration__1_year_construction_and_1'] = 'xx';
  placeholderMap['PV_max_panel_height_m'] = 'xx';
  placeholderMap['LPA_abbreviation'] = lpaValue;

  return placeholderMap;
}

/**
 * Replace placeholders in text with actual values
 * Supports both {{placeholder}} and «placeholder» formats
 * @param {string} text - Text containing placeholders
 * @param {Object} placeholderMap - Map of placeholder names to values
 * @returns {string} Text with placeholders replaced
 */
export function replacePlaceholders(text, placeholderMap) {
  if (!text) return text;

  let result = text;

  const curlyRegex = /\{\{([^}]+)\}\}/g;
  result = result.replace(curlyRegex, (match, placeholderName) => {
    const cleanName = placeholderName.trim();
    return placeholderMap[cleanName] !== undefined ? placeholderMap[cleanName] : match;
  });

  const guillemetRegex = /«([^»]+)»/g;
  result = result.replace(guillemetRegex, (match, placeholderName) => {
    const cleanName = placeholderName.trim();
    return placeholderMap[cleanName] !== undefined ? placeholderMap[cleanName] : match;
  });

  return result;
}

/**
 * Merge template with project data
 * @param {Object} template - Template object from database
 * @param {Object} projectData - Project data from database
 * @returns {Object} Merged content ready for editing
 */
export function mergeTemplateWithProject(template, projectData) {
  const placeholderMap = buildPlaceholderMap(projectData);

  const mergedContent = JSON.parse(JSON.stringify(template.template_content));

  if (mergedContent.sections) {
    mergedContent.sections = mergedContent.sections.map(section => {
      const mergedSection = { ...section };

      if (section.type === 'table' && section.rows) {
        mergedSection.rows = section.rows.map(row => ({
          ...row,
          content: replacePlaceholders(row.content || '', placeholderMap)
        }));
      } else {
        if (section.content) {
          mergedSection.content = replacePlaceholders(section.content, placeholderMap);
        }
        if (section.items && Array.isArray(section.items)) {
          mergedSection.items = section.items.map(item =>
            replacePlaceholders(item, placeholderMap)
          );
        }
      }

      return mergedSection;
    });
  }

  return {
    sections: mergedContent.sections,
    metadata: {
      templateId: template.id,
      templateName: template.template_name,
      templateType: template.template_type,
      projectId: projectData.id,
      projectName: projectData.project_name,
      mergedAt: new Date().toISOString(),
      placeholdersReplaced: Object.keys(placeholderMap).length
    }
  };
}

/**
 * Convert merged content to HTML for rich text editor
 * @param {Object} content - Merged content with sections
 * @returns {string} HTML representation
 */
export function contentToHTML(content) {
  if (!content?.sections) return '';

  let html = '';

  content.sections.forEach(section => {
    switch (section.type) {
      case 'heading': {
        const level = section.level || 2;
        html += `<h${level}>${section.content}</h${level}>`;
        break;
      }
      case 'paragraph':
        html += `<p>${section.content}</p>`;
        break;

      case 'list':
        if (section.items && Array.isArray(section.items)) {
          html += '<ul>';
          section.items.forEach(item => {
            html += `<li>${item}</li>`;
          });
          html += '</ul>';
        }
        break;

      case 'table':
        if (section.rendered_html) {
          html += section.rendered_html;
        } else if (section.rows) {
          html += renderTableFromRows(section.rows, section.id);
        }
        break;

      default:
        html += `<p>${section.content || ''}</p>`;
    }
  });

  return html;
}

/**
 * Convert HTML back to structured sections (for saving)
 * @param {string} html - HTML from rich text editor
 * @returns {Object} Structured content object
 */
export function htmlToContent(html) {
  const sections = [];

  const h1Regex = /<h1>(.*?)<\/h1>/g;
  const h2Regex = /<h2>(.*?)<\/h2>/g;
  const h3Regex = /<h3>(.*?)<\/h3>/g;
  const pRegex = /<p>(.*?)<\/p>/g;
  const ulRegex = /<ul>(.*?)<\/ul>/gs;
  const tableRegex = /<table[^>]*class="[^"]*trp-appraisal-table[^"]*"[^>]*>[\s\S]*?<\/table>/g;

  let match;
  const elements = [];

  while ((match = tableRegex.exec(html)) !== null) {
    const tableHtml = match[0];
    const idMatch = tableHtml.match(/data-section-id="([^"]*)"/);
    const id = idMatch ? idMatch[1] : `table_${elements.length}`;
    elements.push({ type: 'table', id, rendered_html: tableHtml, index: match.index });
  }

  while ((match = h1Regex.exec(html)) !== null) {
    elements.push({ type: 'h1', content: match[1], index: match.index });
  }
  while ((match = h2Regex.exec(html)) !== null) {
    elements.push({ type: 'h2', content: match[1], index: match.index });
  }
  while ((match = h3Regex.exec(html)) !== null) {
    elements.push({ type: 'h3', content: match[1], index: match.index });
  }
  while ((match = pRegex.exec(html)) !== null) {
    elements.push({ type: 'p', content: match[1], index: match.index });
  }
  while ((match = ulRegex.exec(html)) !== null) {
    const liRegex = /<li>(.*?)<\/li>/g;
    const items = [];
    let liMatch;
    while ((liMatch = liRegex.exec(match[1])) !== null) {
      items.push(liMatch[1]);
    }
    elements.push({ type: 'ul', items, index: match.index });
  }

  elements.sort((a, b) => a.index - b.index);

  let sectionId = 0;
  elements.forEach(element => {
    if (element.type === 'table') {
      sections.push({
        id: element.id,
        type: 'table',
        rendered_html: element.rendered_html
      });
    } else if (element.type === 'h1') {
      sections.push({ id: `section_${sectionId++}`, type: 'heading', level: 1, content: element.content });
    } else if (element.type === 'h2') {
      sections.push({ id: `section_${sectionId++}`, type: 'heading', level: 2, content: element.content });
    } else if (element.type === 'h3') {
      sections.push({ id: `section_${sectionId++}`, type: 'heading', level: 3, content: element.content });
    } else if (element.type === 'p') {
      sections.push({ id: `section_${sectionId++}`, type: 'paragraph', content: element.content });
    } else if (element.type === 'ul') {
      sections.push({ id: `section_${sectionId++}`, type: 'list', items: element.items });
    }
  });

  return { sections };
}

export default {
  extractPlaceholders,
  buildPlaceholderMap,
  replacePlaceholders,
  mergeTemplateWithProject,
  contentToHTML,
  htmlToContent
};
