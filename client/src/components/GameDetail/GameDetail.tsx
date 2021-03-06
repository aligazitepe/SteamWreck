import React, { FunctionComponent } from 'react';
import Gallereact from 'gallereact';
import Game from '../../../types/Game';
import './GameDetail.scss'
import GameLinks from '../GameLinks';
import GameTags from '../GameTags';
import ReactHtmlParser from 'react-html-parser';

interface Props {
  location: any // not sure what type this is??
};

const GameDetail: FunctionComponent<any> = (props) => {
  const game: Game = props.location.state;

  const screenshots = game.screenshots.map(srnShot => {
    // add an image prop to each screenshot
    return { ...srnShot, image: srnShot.path_full }
  });


  return (
    <div className="gameDetail">
      <h1 className="gameDetail__name">{game.name}</h1>
      <div className="gameDetail__screenshots">
        <Gallereact images={screenshots} autoPlay={true} duration={3000} />
      </div>
      <div className="gameDetail__links">
        <GameLinks game={game} />
      </div>

      <div className="gameDetail__tags">
        <div className="gameDetail__tags__title">Tags</div>
        <GameTags tags={game.tags} />
      </div>

      <div className="gameDetail__description">
        <div className="gameDetail__description__title">Description</div>
        <div className="gameDetail__longDescription"> { ReactHtmlParser(game.description_steam) }</div>
      </div>

    </div>
  )
};

export default GameDetail;
