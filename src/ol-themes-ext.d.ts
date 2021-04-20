// This represents the ol_themes_ext class which would be available at runtime
export class ol_themes_ext {
    constructor(map: any);
    initThemes(): void;
    initLayers(layers : any[]) : any[];
    initGroups(groups : any[]) : any[];
    initCategories(categories : any[]) : any[];
  }

  // This namespace is merged with the API class and allows for consumers, and this file
  // to have types which are nested away in their own sections.
  declare namespace ol_themes_ext {
  }


  export default ol_themes_ext;