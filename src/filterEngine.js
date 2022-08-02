

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
          inRangeInclusive: (min, max) => {
            source.filterSet.values[field] = { inRangeInclusive: true, values: [min, max] };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          inRangeExclusive: (min, max) => {
            source.filterSet.values[field] = { inRangeExclusive: true, values: [min, max] };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          isGreaterThan: (value) => {
            source.filterSet.values[field] = { isGreaterThan: true, values: [value] };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          isLessThan: (value) => {
            source.filterSet.values[field] = { isLessThan: true, values: [value] };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          isGreaterThanOrEqualTo: (value) => {
            source.filterSet.values[field] = { isGreaterThanOrEqualTo: true, values: [value] };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          isLessThanOrEqualTo: (value) => {
            source.filterSet.values[field] = { isLessThanOrEqualTo: true, values: [value] };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          isNot: (value) => {
            source.filterSet.values[field] = { isNot: true, values: value };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          isNotAny: (values) => {
            source.filterSet.values[field] = { isNotAny: true, values: values };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          isNotAll: (values) => {
            source.filterSet.values[field] = { isNotAll: true, values: values };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          isNull: () => {
            source.filterSet.values[field] = { isNull: true };
            getLogger()(source.filterSet);
            source.changed();
            return _buildEngine(source, vtLayer);
          },
          isNotNull: () => {
            source.filterSet.values[field] = { isNotNull: true };
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
    
    if(source.filterSet) {
      let value = false;

      if(source.filterSet.mode == "AND")
          value = true;
    
      let keys = Object.keys(source.filterSet.values);
      let fields = Object.keys(feature.properties_);

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
                for(let val of filter.values)
                    filterMatch = filterMatch && valueToTest == val;
              }
              else if(filter.contains && (valueToTest+"").indexOf(filter.values) >= 0)
                  filterMatch = true;
              else if(filter.containsAny) {
                filterMatch = false || filter.values.length == 0;
                for(let val of filter.values) {
                  if ((valueToTest+"").indexOf(val) >= 0) {
                      filterMatch = true;
                      break;
                  }
                }
              }
              else if(filter.containsAll) {
                  filtermatch = true;
                  for(let val of filter.values) {
                    if(((valueToTest+"").indexOf(val) < 0)) {
                      filterMatch = false;
                      break;
                    }
                  }
              }
              else if(filter.exactly && valueToTest == filter.values) {
                filterMatch = true;
              }
              else if(filter.inRangeInclusive) {
                let [min, max] = filter.values;
                filterMatch = valueToTest >= min && valueToTest <= max;
              }
              else if(filter.inRangeExclusive) {
                let [min, max] = filter.values;
                filterMatch = valueToTest > min && valueToTest < max;
              }
              else if(filter.isGreaterThan) {
                let [min] = filter.values;
                filterMatch = valueToTest > min;
              }
              else if(filter.isLessThan) {
                let [max] = filter.values;
                filterMatch = valueToTest < max;
              }
              else if(filter.isGreaterThanOrEqualTo) {
                let [min] = filter.values;
                filterMatch = valueToTest >= min;
              }
              else if(filter.isLessThanOrEqualTo) {
                let [max] = filter.values;
                filterMatch = valueToTest <= max;
              }
              else if(filter.isNot) {
                filterMatch = valueToTest != filter.values;
              }
              else if(filter.isNotAny) {
                filterMatch = !filter.values.includes(valueToTest);
              }
              else if(filter.isNotAll) {
                filterMatch = filter.values.includes(valueToTest);
              }
              else if(filter.isNull) {
                filterMatch = valueToTest == null;
              }
              else if(filter.isNotNull) {
                filterMatch = valueToTest != null;
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