import { gettext } from 'i18n'

AppSettingsPage({
  state: {
    entityList: [],
    props: {},
  },
  setState(props) {
    this.state.props = props;
    if (props.settingsStorage.getItem("entityList")) {
      this.state.entityList = JSON.parse(
        props.settingsStorage.getItem("entityList")
      );
    } else {
      this.state.entityList = [];
      console.log("Initialized");
    }
  },
  setItem() {
    const newStr = JSON.stringify(this.state.entityList);
    this.state.props.settingsStorage.setItem("entityList", newStr);
  },
  toggleEntity(key, val) {
    const newEntityList = this.state.entityList.map((_item) => {
      const item = _item;
      if (item.key === key) {
        item.value = val;
      }
      return item;
    });
    this.state.entityList = newEntityList;
    this.setItem();
  },
  moveEntityToTop(index) {
    const entity = this.state.entityList[index];
    this.state.entityList = this.state.entityList.filter((_, ind) => {
      return ind !== index
    })
    this.state.entityList.unshift(entity);
    this.setItem()
  },
  build(props) {
    this.setState(props);
    const textInputStyle = {
      color: "#000000",
      fontSize: "15px",
      borderStyle: "solid",
      borderColor: "#000000",
      borderRadius: "2px",
      height: "28px",
      marginLeft: "200px",
      overflow: "hidden",
      borderWidth: "2px",
      margin: "10px",
    };
    const textInputStyle2 = {
      color: "#000000",
      fontSize: "15px",
      borderStyle: "solid",
      borderColor: "#000000",
      borderRadius: "2px",
      width: "70%",
      height: "28px",
      marginLeft: "200px",
      overflow: "hidden",
      borderWidth: "2px",
      margin: "10px",
    };
    let entityList = [];
    let filter = props.settingsStorage.getItem("filter")
    this.state.entityList.forEach((item, i) => {
      if (
        !item.key.startsWith('light.') &&
        !item.key.startsWith('switch.') &&
        !item.key.startsWith('input_boolean.') &&
        !item.key.startsWith('binary_sensor.') &&
        !item.key.startsWith('sensor.') &&
        !item.key.startsWith('media_player.') &&
        !item.key.startsWith('script.') &&
        !item.key.startsWith('automation.')
      ) {
        return;
      }
      if(!item.key.includes(filter)) {
        return;
      }
      entityList.push(
        View({
          style: {
            position: 'relative',
            display: 'flex',
            borderBottom: "1px solid #eaeaea",
            padding: "6px 0",
            marginBottom: '6px'
          }},
        [
          View({ style: { width: "70%" }},
            Toggle({
              label: `${item.title} (${item.key})`,
              value: item.value,
              onChange: this.toggleEntity.bind(this, item.key),
            })
          ),
          View({ style: { flex: 1 }},
            Button({
              label: gettext('Top'),
              style: {
                position: 'absolute',
                bottom: '10px',
                right: '0px',
                minWidth: '32px',
                height: '20px',
                borderRadius: '60px',
                background: '#3ddc84',
                color: 'black'
              },
              onClick: () => {
                this.moveEntityToTop(i)
              }
            }),
          )
        ])
      );
    });
    return Section({}, [
      Section({ style: {fontSize: '17px',fontWeight: 'bold',paddingLeft: '10px',paddingTop: '5px',paddingBottom: '5px'} }, gettext('Access')),
      Section({ style: {fontSize: '15px',paddingLeft: '10px'} }, gettext('IPLocal')),
      Section({ style: {fontSize: '13px',fontStyle: 'italic',paddingLeft: '10px'} }, "e.g. http://homeassistant.local:8123/"),
      TextInput({
        settingsKey: "localHAIP",
        subStyle: textInputStyle,
      }),
      Section({ style: {fontSize: '15px',paddingLeft: '10px'} }, gettext('IPExternal')),
      Section({ style: {fontSize: '13px',fontStyle: 'italic',paddingLeft: '10px'} }, "e.g. https://aguacatec.es/"),
      TextInput({
        settingsKey: "externalHAIP",
        subStyle: textInputStyle,
      }),
      Section({ style: {fontSize: '15px',paddingLeft: '10px'} }, gettext('LongToken')),
      Section({ style: {fontSize: '13px',fontStyle: 'italic',paddingLeft: '10px'} }, gettext('FromProfile')),
      TextInput({
        settingsKey: "HAToken",
        subStyle: textInputStyle,
      }),
      Section(
        { style: {width: '5px'} },
        Toggle({
          value: (props.settingsStorage.getItem("updateSensorsBool") === "true"),
          onChange: (value) => {
            props.settingsStorage.setItem("updateSensorsBool", value);
          },
        })
      ),
      Section({ style: {fontSize: '15px',marginLeft: '60px',marginTop: '-30px'} }, gettext('UpdateSensor')),
      Section({ style: {fontSize: '13px',fontStyle: 'italic',marginLeft: '60px'} }, gettext('WorksBetter')),
      Section({ style: {fontSize: '17px',fontWeight: 'bold',paddingLeft: '10px',paddingTop: '10px',paddingBottom: '5px'} }, gettext('Entities')),
      Text({ style: {fontSize: '15px',paddingLeft: '10px'} }, gettext('SearchEntities')),
      Section({ style: {fontSize: '13px',fontStyle: 'italic',paddingLeft: '10px',paddingRight: '50px'} }, gettext('SearchEntitiesEG')),
      TextInput({
        subStyle: textInputStyle2,
        settingsKey: "filter",
      }),
      Section(
        {},
        Button({ style: {marginLeft: '75%',marginTop: '-75px',height: '28px'},
          label: gettext('Search'),
          async onClick() {
            props.settingsStorage.removeItem("entityList");
            props.settingsStorage.setItem("listFetchRandom", Math.random());
            return;
          },
        })
      ),
      entityList.length > 0 &&
        View(
          {
            style: {
              marginTop: "12px",
              padding: "10px",
              border: "1px solid #eaeaea",
              borderRadius: "6px",
              backgroundColor: "white",
            },
          },
          entityList
        ),
    ]);
  },
});
