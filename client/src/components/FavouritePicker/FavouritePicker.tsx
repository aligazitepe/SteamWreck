import React, { FunctionComponent  } from 'react';

interface Props {
  appId: number,
};

const FavouritePicker: FunctionComponent<Props> = (props) => {
  return <div>{props.appId}</div>;

  // image here
  // click handler on image



};

export default FavouritePicker;
