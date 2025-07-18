

import { getLogger } from './logger'

//layer.filter.when(field).isAny([])
//layer.filter.when(field).isAll([])

export const _buildEngine = (source,vtLayer) => {

    if(!source.filterSet)
        source.filterSet = { mode: "NONE", values: {}, layer: null };
  
    return {
      when: (field) => {
        
        if(source.filterSet.mode == "NONE")
          source.filterSet.mode = "OR"

        return {
          isAny: (values) => {
            source.filterSet.values[field] = { any: true, values: values };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          isAll: (values) => {
            source.filterSet.values[field] = { all: true, values: values };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          contains: (value) => {
            source.filterSet.values[field] = { contains: true, values: value };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          containsAny: (values) => {
            source.filterSet.values[field] = { containsAny: true, values: values };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          containsAll: (values) => {
            source.filterSet.values[field] = { containsAll: true, values: values };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          isExactly: (value) => {
            source.filterSet.values[field] = { exactly: true, values: value };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);              
          },
          clear : () => {
            delete source.filterSet.values[field];
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer); 
          }
        }
      },
      clear: () => {
        source.filterSet.values = {};
        source.filterSet.mode = "NONE"
        source.changed();
        return _buildEngine(source, vtLayer);              
      },
      andJoin: () => {
        source.filterSet.mode = "AND"
        getLogger()(source.filterSet);
        source.changed();
        return _buildEngine(source, vtLayer);
      },
      orJoin: () => {
        source.filterSet.mode = "OR"
        getLogger()(source.filterSet);
        source.changed();
        return _buildEngine(source, vtLayer);
      },
      appliesTo: (layer) => {
        source.filterSet.layer = layer;
        getLogger()(source.filterSet);
        source.changed();
        return _buildEngine(source, vtLayer);  
      }
    }
  };

export const _checkFilter = (source, feature) => {
    getLogger()("Checking filters for", feature.getId(), "on source", source.id);
    if(source.filterSet) {
      let value = false;

      if(source.filterSet.mode == "AND")
          value = true;
    
      let keys = Object.keys(source.filterSet.values);
      let fields = Object.keys(feature.properties_);
      getLogger()("Filter keys", keys, "fields", fields);

      if(!keys.length)
          value = true;

      for(let field of keys) {
          getLogger()("Checking", field);
          let filterMatch = false;

          if(fields.includes(field)) {
              let filter = source.filterSet.values[field];
              let valueToTest = feature.properties_[field];

              getLogger()("Testing", valueToTest);

              if(filter.any && filter.values.includes(valueToTest))
                filterMatch = true;
              else if(filter.all) {
                filterMatch = true;
                for(let value of filter.values)
                    filterMatch = filterMatch && valueToTest == value;
              }
              else if(filter.contains && (valueToTest+"").indexOf(filter.values) >= 0)
                  filterMatch = true;
              else if(filter.containsAny) {
                filterMatch = false || filter.values.length == 0;
                for(let value of filter.values) {
                  if ((valueToTest+"").indexOf(value) >= 0) {
                      filterMatch = true;
                      break;
                  }
                }
              }
              else if(filter.containsAll) {
                  filtermatch = true;
                  for(let value of filter.values) {
                    if(((valueToTest+"").indexOf(value) < 0)) {
                      filterMatch = false;
                      break;
                    }
                  }
              }
              else if(filter.exactly && valueToTest == filter.values) {
                filterMatch = true;
              }
          }
          else
          {
            filterMatch = false;
          }
              
          if(source.filterSet.mode == "AND")
              value = value && filterMatch;

          if(source.filterSet.mode == "OR")
              value = value || filterMatch;
      }

      return value;
    }

    //When there is no filterSet, everything is shown
    return true;
}