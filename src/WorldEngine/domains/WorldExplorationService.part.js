    class WorldExplorationService {
        constructor(engine){this.engine=engine;}
        snapshot(){
            const stat=this.engine.snapshot().stat||{},world=stat.世界||{},backend=world?.[PATH]||{};
            return {探索:copy(world.探索||{}),势力:copy(world.势力||{}),势力地区:copy(backend.势力地区||{})};
        }
    }
